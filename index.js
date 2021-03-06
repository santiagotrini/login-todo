// dependencies
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const session = require('express-session');
const bcrypt = require('bcrypt');

// config
const port = process.env.PORT || 3000;
const db = 'mongodb://localhost/mvc_app';
// const db = 'mongodb://user:user1234@ds353007.mlab.com:53007/mvc_app'

// database connection
mongoose.set('useFindAndModify', false);
mongoose
  .connect(db, { useNewUrlParser: true })
  .then(() => {
    console.log("DB connected");
  })
.catch(err => console.error(`Connection error ${err}`));

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
  }
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
// passport requiere estas dos lineas de middleware
app.use(passport.initialize());
app.use(passport.session());
// fin setear passport
app.set('view engine', 'pug');
app.set('views', './views');
app.use(express.static('public'));

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
    Todo.find({ author: req.user._id }, (err, todos) => {
      if (err) return next(err);
      res.render('dashboard', { user: req.user, todos: todos });
    });
  });
app.get('/logout',
  (req, res) => {
    req.logout();
    res.redirect('/');
});
app.post('/delete/todo', (req, res) => {
  Todo.findByIdAndRemove(req.body.id, err => {
    if (err) return next(err);
    res.redirect('/dashboard');
  });
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
    res.redirect('/dashboard');
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
      // guardamos el hash en la db
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
