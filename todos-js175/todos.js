const express = require('express');
const morgan = require('morgan');
const flash = require("express-flash");
const session = require("express-session");
const { body, validationResult } = require('express-validator');
const TodoList = require('./lib/todolist');
const Todo = require("./lib/todo");
const { sortTodoLists, sortTodos } = require("./lib/sort");
const store = require('connect-loki');

const app = express();
const host = 'localhost';
const port = 3000;
const LokiStore = store(session);

app.set("views", "./views");
app.set("view engine", "pug");

app.use(morgan("common"));
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));

app.use(session({
  cookie: {
    httpOnly: true,
    maxAge: 31 * 24 * 60 * 60 * 1000, // 31 days in millseconds
    path: "/",
    secure: false,
  },
  name: 'launch-school-todos-session-id',
  resave: false,
  saveUninitialized: true,
  secret: 'this is not very secure',
  store: new LokiStore({}),
}));

app.use(flash());

app.use((req, res, next) => {
  let todoLists = [];
  if ("todoLists" in req.session) {
    req.session.todoLists.forEach(todoList => {
      todoLists.push(TodoList.makeTodoList(todoList));
    });
  } 

  req.session.todoLists = todoLists;

  next();
});

app.use((req, res, next) => {
  res.locals.flash = req.session.flash;
  delete req.session.flash;
  next();
});

app.get('/', (req, res) => {
  res.redirect('/lists');
});

app.get('/lists/new', (req, res) => {
  res.render('new-list');
});

app.get('/lists', (req, res) => {
  res.render('lists', { 
    todoLists: sortTodoLists(req.session.todoLists),
  });
});

app.post("/lists",
  [
    body("todoListTitle")
      .trim()
      .isLength({ min: 1 })
      .withMessage("The list title is required.")
      .isLength({ max: 25 })
      .withMessage("List title must be between 1 and 25 characters.")
      .custom((title, { req }) => {
        let todoLists = req.session.todoLists;
        let duplicate = todoLists.find(list => list.title === title);
        return duplicate === undefined;
      })
      .withMessage("List title must be unique."),
  ],
  (req, res) => {
    let errors = validationResult(req);
    if (!errors.isEmpty()) {
      errors.array().forEach(message => req.flash("error", message.msg));
      res.render("new-list", {
        flash: req.flash(),
        todoListTitle: req.body.todoListTitle,
      });
    } else {
      req.session.todoLists.push(new TodoList(req.body.todoListTitle));
      req.flash("success", "The todo list has been created.");
      res.redirect("/lists");
    }
  }
);

app.get('/lists/:todoListId', (req, res) => {
  let id = req.params.todoListId;
  let todoWithCurrentId = req.session.todoLists.filter(todo => {
    if (todo.id === Number(id)) return todo;
  });
  if (todoWithCurrentId === undefined) {
    next(new Error("Not found."));
  } else {
    res.render('list', { 
      todoList: todoWithCurrentId[0],
      todos: sortTodoLists(todoWithCurrentId[0].todos),
    });
  }
});

app.use((err, req, res, _next) => {
  console.log(err); // Writes more extensive information to the console log
  res.status(404).send(err.message);
});

app.post('/lists/:todoListId/todos/:choreId/toggle', (req, res, next) => {
  let todoListId = req.params.todoListId;
  let choreId = req.params.choreId;
  let todoWithCurrentId = req.session.todoLists.filter(todo => {
    if (todo.id === Number(todoListId)) return todo;
  });
  let todo = todoWithCurrentId[0].todos.find(todo => {
    if (todo.id === Number(choreId)) return todo;
  });
  if (!todo) {
    next(new Error("Not found."));
  } else {
    if (todo.isDone()) {
      todo.markUndone();
      req.flash('success', `"${todo.title}" marked as NOT done!`);
    } else {
      todo.markDone();
      req.flash('success', `"${todo.title}" marked as done!`);
    }
    res.redirect(`/lists/${todoListId}`);
  }
});

app.post('/lists/:todoListId/todos/:choreId/destroy', (req, res, next) => {
  let todoListId = req.params.todoListId;
  let choreId = req.params.choreId;
  let todoWithCurrentId = req.session.todoLists.filter(todo => {
    if (todo.id === Number(todoListId)) return todo;
  });
  let todo = todoWithCurrentId[0].todos.find(todo => {
    if (todo.id === Number(choreId)) return todo;
  });
  if (!todo) {
    next(new Error("Not found."));
  } else {
    let indexOfTodo = todoWithCurrentId[0].findIndexOf(todo);
    todoWithCurrentId[0].removeAt(indexOfTodo);
    req.flash("success", "The todo has been deleted.");
    res.redirect(`/lists/${todoListId}`);
  }
});

app.post('/lists/:todoListId/complete_all', (req, res, next) => {
  let todoListId = req.params.todoListId;
  let todoWithCurrentId = req.session.todoLists.filter(todo => {
    if (todo.id === Number(todoListId)) return todo;
  });
  if (!todoWithCurrentId) {
    next(new Error("Not found."));
  } else {
    todoWithCurrentId[0].markAllDone();
    res.redirect(`/lists/${todoListId}`);
  }
});

app.post('/lists/:todoListId/todos', 
[
  body("todoTitle")
    .trim()
    .isLength({ min: 1 })
    .withMessage("The todo title is required.")
    .isLength({ max: 25 })
    .withMessage("Todo title must be between 1 and 25 characters."),
],
(req, res, next) => {
  let todoListId = req.params.todoListId;
  let todoWithCurrentId = req.session.todoLists.filter(todo => {
    if (todo.id === Number(todoListId)) return todo;
  });
  if (!todoWithCurrentId) {
    next(new Error("Not found."));
  } else {
    let errors = validationResult(req);
    if (!errors.isEmpty()) {
      errors.array().forEach(message => req.flash("error", message.msg));

      res.render("list", {
        flash: req.flash(),
        todoList: todoWithCurrentId[0],
        todos: sortTodos(todoWithCurrentId[0]),
        todoTitle: req.body.todoTitle,
      });
    } else {
      let todo = new Todo(req.body.todoTitle);
      todoWithCurrentId[0].add(todo);
      req.flash("success", "The todo has been created.");
      res.redirect(`/lists/${todoListId}`);
    }
  }
});

app.get('/lists/:todoListId/edit', (req, res, next) => {
  let todoListId = req.params.todoListId;
  let todoWithCurrentId = req.session.todoLists.filter(todo => {
    if (todo.id === Number(todoListId)) return todo;
  });
  if (!todoWithCurrentId) {
    next(new Error("Not found."));
  } else {
    let todoList = todoWithCurrentId[0];
    res.render('edit-list', { todoList });
  }
});

app.post('/lists/:todoListId/destroy', (req, res, next) => {
  let todoListId = req.params.todoListId;
  let todoWithCurrentId = req.session.todoLists.filter(todo => {
    if (todo.id === Number(todoListId)) return todo;
  });
  let title = todoWithCurrentId[0].title;
  let indexOfTodoToDelete = undefined;
  req.session.todoLists.find((todo, idx) => {
    indexOfTodoToDelete = idx;
    if (todo.title === title) return true;
  });

  if (indexOfTodoToDelete === undefined) {
    next(new Error("Not found."));
  } else {
    req.session.todoLists.splice(indexOfTodoToDelete, 1);
    req.flash("success", "Todo list deleted.");
    res.redirect('/lists');
  }
});

app.post('/lists/:todoListId/edit', 
[
  body("todoListTitle")
    .trim()
    .isLength({ min: 1 })
    .withMessage("The list title is required.")
    .isLength({ max: 25 })
    .withMessage("List title must be between 1 and 25 characters.")
    .custom((title, { req }) => {
      let todoLists = req.session.todoLists;
      let duplicate = todoLists.find(list => list.title === title);
      return duplicate === undefined;
    })
    .withMessage("List title must be unique."),
], 
(req, res, next) => {
  let todoListId = req.params.todoListId;
  let todoWithCurrentId = req.session.todoLists.filter(todo => {
    if (todo.id === Number(todoListId)) return todo;
  });
  console.log(todoWithCurrentId[0])
  let todoList = todoWithCurrentId[0];
  if (!todoList) {
    next(new Error("Not found."));
  } else {
    let errors = validationResult(req);
    if (!errors.isEmpty()) {
      errors.array().forEach(message => req.flash("error", message.msg));

      res.render("edit-list", {
        flash: req.flash(),
        todoListTitle: req.body.todoListTitle,
        todoList: todoList,
      });
    } else {
      todoList.setTitle(req.body.todoListTitle);
      req.flash("success", "Todo list updated.");
      res.redirect(`/lists/${todoListId}`);
    }
  }
});

app.listen(port, host, () => {
  console.log(`Todos is listening on port ${port} of ${host}!`)
});