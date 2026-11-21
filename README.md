# APITrace Express Todo Test App

This small Express Todo app is a test project for [`apitrace-express`](https://github.com/kumarroushan9898/ApiTrace). Use it to generate real HTTP requests, inspect their timings in the APITrace portal, and check how the package records successful requests and validation failures. The Todo UI uses plain HTML, CSS, and JavaScript, and tasks are saved in `data/todos.json`.

## Run locally

Use Node.js 22 or newer and npm. From the Todo project directory, install the dependencies, including the published `apitrace-express@0.1.1` package, then start the app:

```sh
npm ci
npm start
```

`npm start` starts the Todo app and the bundled APITrace portal in one process.

| Service | Default address |
| --- | --- |
| Todo app | [http://127.0.0.1:3000/](http://127.0.0.1:3000/) |
| APITrace portal | [http://127.0.0.1:4319/](http://127.0.0.1:4319/) |
| Trace history JSON | [http://127.0.0.1:4319/api/traces](http://127.0.0.1:4319/api/traces) |

Set `PORT` to change the Todo app port and `APITRACE_PORT` to change the portal and collector port. Both listeners default to `127.0.0.1`. Set `HOST` to change the Todo app's bind address. Trace history is kept in memory and resets when the process restarts.

## Deploy on Render

Import the repository as a Render Blueprint to use [render.yaml](render.yaml). The Free web service exposes the Todo app and API. The APITrace portal and collector stay on the server's loopback interface. Render's Free filesystem resets when the service restarts, spins down, or redeploys, so hosted tasks are temporary.

## Test a trace

1. Open the Todo app and add a task. Edit it, mark it complete, or delete it to generate more requests.
2. Open **Trace Explorer** in the APITrace portal and search for `/api/todos`.
3. Open a successful `POST /api/todos` trace to see the `Parse JSON`, `Create todo`, `Read todos JSON`, and `Write todos JSON` spans.
4. Open **Live Requests** and run the command below. It sends a blank title and should produce an HTTP 400 trace.

```sh
curl -i -X POST http://127.0.0.1:3000/api/todos \
  -H 'Content-Type: application/json' \
  -d '{"title":""}'
```

## Todo API

| Method and path | Behavior |
| --- | --- |
| `GET /api/todos` | List tasks. |
| `POST /api/todos` | Create a task with a `title`. |
| `PATCH /api/todos/:id` | Update the `title`, the `completed` boolean, or both. |
| `DELETE /api/todos/:id` | Delete a task. |

The tracing setup is in [server.js](server.js). It mounts the package middleware before the routes, uses `apiTrace.wrap()` for middleware and controllers, and uses `apiTrace.trace()` around JSON reads and writes.
