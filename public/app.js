const addForm = document.querySelector('#add-task');
const newTitle = document.querySelector('#new-title');
const addButton = addForm.querySelector('button');
const list = document.querySelector('#tasks');
const template = document.querySelector('#task-template');
const summary = document.querySelector('#summary');
const empty = document.querySelector('#empty');
const pageError = document.querySelector('#error');

const dialog = document.querySelector('#edit-task');
const editForm = dialog.querySelector('form');
const editTitle = document.querySelector('#edit-title');
const saveButton = editForm.querySelector('[type="submit"]');
const cancelButton = editForm.querySelector('.secondary');
const editError = dialog.querySelector('.error');
let editingTask = null;

async function request(method = 'GET', taskId, data) {
  const url = taskId ? `/api/todos/${encodeURIComponent(taskId)}` : '/api/todos';
  const options = { method };
  if (data) {
    options.headers = { 'Content-Type': 'application/json' };
    options.body = JSON.stringify(data);
  }
  const response = await fetch(url, options);
  if (response.status === 204) return;
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}

function showError(element, message = '') {
  element.textContent = message;
  element.hidden = !message;
}

function updateSummary() {
  const total = list.children.length;
  const remaining = list.querySelectorAll('input:not(:checked)').length;
  summary.textContent = `${remaining} of ${total} ${total === 1 ? 'task' : 'tasks'} remaining`;
  empty.hidden = total > 0;
}

function createTaskItem(todo) {
  const item = template.content.firstElementChild.cloneNode(true);
  const checkbox = item.querySelector('input');
  const title = item.querySelector('span');
  const [editButton, deleteButton] = item.querySelectorAll('button');

  function updateTaskItem(task) {
    checkbox.checked = task.completed;
    title.textContent = task.title;
    editButton.setAttribute('aria-label', `Edit ${task.title}`);
    deleteButton.setAttribute('aria-label', `Delete ${task.title}`);
  }

  checkbox.addEventListener('change', async () => {
    showError(pageError);
    const completed = checkbox.checked;
    checkbox.disabled = true;
    editButton.disabled = true;
    deleteButton.disabled = true;
    try {
      await request('PATCH', todo.id, { completed });
      updateSummary();
    } catch (error) {
      checkbox.checked = !completed;
      updateSummary();
      showError(pageError, error.message);
    } finally {
      checkbox.disabled = false;
      editButton.disabled = false;
      deleteButton.disabled = false;
    }
  });

  editButton.addEventListener('click', () => {
    editingTask = { id: todo.id, updateTaskItem };
    editTitle.value = title.textContent;
    showError(editError);
    dialog.showModal();
  });

  deleteButton.addEventListener('click', async () => {
    showError(pageError);
    deleteButton.disabled = true;
    editButton.disabled = true;
    checkbox.disabled = true;
    try {
      await request('DELETE', todo.id);
      item.remove();
      updateSummary();
      newTitle.focus();
    } catch (error) {
      showError(pageError, error.message);
      deleteButton.disabled = false;
      editButton.disabled = false;
      checkbox.disabled = false;
    }
  });

  updateTaskItem(todo);
  return item;
}

addForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (addButton.disabled) return;
  showError(pageError);
  addButton.disabled = true;
  newTitle.readOnly = true;
  try {
    const todo = await request('POST', null, { title: newTitle.value });
    list.append(createTaskItem(todo));
    addForm.reset();
    updateSummary();
  } catch (error) {
    showError(pageError, error.message);
  } finally {
    addButton.disabled = false;
    newTitle.readOnly = false;
    newTitle.focus();
  }
});

cancelButton.addEventListener('click', () => dialog.close());
dialog.addEventListener('cancel', (event) => {
  if (saveButton.disabled) event.preventDefault();
});

editForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (saveButton.disabled) return;
  showError(editError);
  saveButton.disabled = true;
  cancelButton.disabled = true;
  editTitle.readOnly = true;
  try {
    const todo = await request('PATCH', editingTask.id, { title: editTitle.value });
    editingTask.updateTaskItem(todo);
    dialog.close();
  } catch (error) {
    showError(editError, error.message);
  } finally {
    saveButton.disabled = false;
    cancelButton.disabled = false;
    editTitle.readOnly = false;
  }
});

async function loadTasks() {
  try {
    const todos = await request();
    list.append(...todos.map(createTaskItem));
    updateSummary();
    addButton.disabled = false;
  } catch (error) {
    summary.textContent = 'Tasks could not be loaded.';
    showError(pageError, `${error.message} Reload the page to try again.`);
  }
}

loadTasks();
