const express = require('express');
const apiTrace = require('apitrace-express');
const { randomUUID } = require('node:crypto');
const { mkdir, readFile, rename, rm, writeFile } = require('node:fs/promises');
const path = require('node:path');

const app = express();
const tracePort = process.env.APITRACE_PORT ?? '4319';
const dashboard = tracePort ? apiTrace.createDashboard() : null;
app.use(dashboard ? dashboard.middleware() : apiTrace());

const dataDirectory = path.join(__dirname, 'data');
const dataFile = path.join(dataDirectory, 'todos.json');
const temporaryFile = path.join(dataDirectory, 'todos.tmp');
let pendingWrite = Promise.resolve();

function readTodos() {
  return apiTrace.trace('Read todos JSON', async () => {
    try {
      return JSON.parse(await readFile(dataFile, 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  });
}

function updateTodos(update) {
  // Serialize each read, change, and write so concurrent requests keep all updates.
  const write = pendingWrite.then(async () => {
    const todos = await readTodos();
    const result = update(todos);
    if (!result) return null;

    await apiTrace.trace('Write todos JSON', async () => {
      await mkdir(dataDirectory, { recursive: true });
      try {
        await writeFile(temporaryFile, `${JSON.stringify(todos, null, 2)}\n`);
        await rename(temporaryFile, dataFile);
      } finally {
        await rm(temporaryFile, { force: true });
      }
    });
    return result;
  });

  pendingWrite = write.catch(() => {});
  return write;
}

function readTitle(value) {
  if (typeof value !== 'string') return null;
  const title = value.trim();
  return title.length > 0 && title.length <= 200 ? title : null;
}

const titleError = 'Enter a task between 1 and 200 characters.';
const controller = { type: 'controller' };

app.use('/api/todos', apiTrace.wrap('Parse JSON', express.json({ limit: '16kb' })));

app.get('/api/todos', apiTrace.wrap('List todos', async (req, res) => {
  res.set('Cache-Control', 'no-store').json(await readTodos());
}, controller));

app.post('/api/todos', apiTrace.wrap('Create todo', async (req, res) => {
  const title = readTitle(req.body?.title);
  if (!title) return res.status(400).json({ error: titleError });

  const todo = await updateTodos((todos) => {
    const task = { id: randomUUID(), title, completed: false };
    todos.push(task);
    return task;
  });
  res.status(201).json(todo);
}, controller));

app.patch('/api/todos/:id', apiTrace.wrap('Update todo', async (req, res) => {
  const { title, completed } = req.body ?? {};
  const changes = {};

  if (title !== undefined) {
    changes.title = readTitle(title);
    if (!changes.title) return res.status(400).json({ error: titleError });
  }
  if (completed !== undefined) {
    if (typeof completed !== 'boolean') {
      return res.status(400).json({ error: 'Completion must be true or false.' });
    }
    changes.completed = completed;
  }
  if (Object.keys(changes).length === 0) {
    return res.status(400).json({ error: 'Provide a title or completion status.' });
  }

  const todo = await updateTodos((todos) => {
    const task = todos.find(({ id }) => id === req.params.id);
    return task ? Object.assign(task, changes) : null;
  });
  if (!todo) return res.status(404).json({ error: 'Task not found.' });
  res.json(todo);
}, controller));

app.delete('/api/todos/:id', apiTrace.wrap('Delete todo', async (req, res) => {
  const todo = await updateTodos((todos) => {
    const index = todos.findIndex(({ id }) => id === req.params.id);
    return index === -1 ? null : todos.splice(index, 1)[0];
  });
  if (!todo) return res.status(404).json({ error: 'Task not found.' });
  res.status(204).end();
}, controller));

app.use(express.static(path.join(__dirname, 'public')));
app.use(apiTrace.errorHandler);

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Send valid JSON.' });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request is too large.' });
  }
  console.error(error);
  res.status(500).json({ error: 'The server could not access your tasks.' });
});

const server = app.listen(process.env.PORT || 3000, process.env.HOST || '127.0.0.1');
server.on('listening', () => {
  const appUrl = `http://127.0.0.1:${server.address().port}`;
  console.log(`Todo app running at ${appUrl}`);
  console.log(`Todo API          ${appUrl}/api/todos`);

  if (dashboard) {
    dashboard.listen(Number(tracePort)).then((listener) => {
      console.log(`APITrace portal   ${listener.url}/`);
      console.log(`Trace history     ${listener.url}/api/traces`);
      console.log(`Live trace events ${listener.url}/api/events`);
    }).catch((error) => {
      console.error('Could not start the APITrace collector:', error.message);
    });
  }
});
