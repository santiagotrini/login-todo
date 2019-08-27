// dependencies
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const session = require('express-session');
const bcrypt = require('bcrypt');

// config
const port = 3000;
const db = 'mongodb://localhost/app';

// database connection
mongoose.set('useFindAndModify', false);
mongoose.connect(db, { useNewUrlParser: true })
.then(() => {
  console.log('DB connected');
});

// models
// User schema
const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  todos: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Todo'
  }]
});
// User model
const User = mongoose.model('User', UserSchema);

// Todo schema
const TodoSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true
  },
  done: {
    type: Boolean,
    default: false
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
});
// Todo model
const Todo = mongoose.model('Todo', TodoSchema);


// passport config
const LocalStrategy = require('passport-local').Strategy;
passport.use(new LocalStrategy((username, password, done) => {
  User.findOne({ username: username }, (err, user) => {
    if (err) return done(err);
    if (!user) return done(null, false);
    bcrypt.compare(password, user.password, (err, res) => {
      if (err) throw err;
      if (!res) return done(null, false);
      else return done(null, user);
    });
  });
}));
passport.serializeUser((user, done) => {
  done(null, user._id);
});
passport.deserializeUser((id, done) => {
  User.findById(id, (err, user) => {
    if (err) return done(err);
    done(null, user);
  });
});

// express app
const app = express();

// middleware
app.use(session({
  secret: 'app secret',
  resave: false,
  saveUninitialized: false
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());
app.use(passport.session());
app.set('view engine', 'pug');
app.set('views', './views');

// routes & controllers
// site routes
app.get('/', (req, res) => {
  if (req.user) res.redirect('/dashboard');
  else res.render('index');
});
app.post('/login',
  passport.authenticate('local', { failureRedirect: '/' }),
  (req, res) => {
    res.redirect('/dashboard');
  }
);
app.get('/dashboard',
  require('connect-ensure-login').ensureLoggedIn('/'),
  (req, res) => {
    User
    .findById(req.user._id)
    .populate('todos')
    .exec((err, user) => {
      if (err) return next(err);
      res.render('dashboard', { user: user });
    });
  });
app.get('/logout',
  (req, res) => {
    req.logout();
    res.redirect('/');
});

// REST API
// Todo routes
// POST /todo
app.post('/todo', (req, res) => {
  const todo = new Todo({
    description: req.body.description,
    author: req.user._id
  });
  todo.save(err => {
    if (err) return next(err);
    User.findById(req.user._id, (err, user) => {
      user.todos.push(todo._id);
      user.save(err => {
        res.redirect('/dashboard');
      });
    });
  });
});
// GET /todos
app.get('/todos', (req, res) => {
  Todo.find((err, todos) => {
    if (err) return next(err);
    res.status(200).json(todos);
  });
});
app.delete('/todo/:id', (req, res) => {
  Todo.findByIdAndRemove(req.params.id, err => {
    if (err) return next(err);
    res.status(200).json({ msg: 'delete OK' });
  });
});

// User routes
// POST /user
app.post('/user', (req, res) => {
  const user = new User({
    username: req.body.username,
    password: req.body.password
  });
  // hashear password
  bcrypt.genSalt(10, (err, salt) => {
    bcrypt.hash(user.password, salt, (err, hash) => {
      if (err) throw err;
      user.password = hash;
      user.save(err => {
        if (err) return next(err);
        res.redirect('/');
      });
    });
  });
});
// GET /users
app.get('/users', (req, res) => {
  User.find((err, users) => {
    if (err) return next(err);
    res.status(200).json(users);
  });
});
// DELETE /user/:id
app.delete('/user/:id', (req, res) => {
  User.findByIdAndRemove(req.params.id, err => {
    if (err) return next(err);
    res.status(200).json({ msg: 'delete OK' });
  });
});

// listen
app.listen(port, () => { console.log(`Server listening on port ${port}`) });
