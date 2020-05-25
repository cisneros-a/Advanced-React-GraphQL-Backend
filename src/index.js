const cookierParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
require("dotenv").config({ path: "variables.env" });
const createServer = require("./createServer");
const db = require("./db");

const server = createServer();

// TODO Use express middlware to handle cookies (JWT)
server.express.use(cookierParser());

// TODO Use express middlware to populate current user

// Decode the JWT so that we can get the user ID on each request
// You always get a request, response, and next
// We don't have to explicity send cookies along with our requests. They automatically
// come. This is different than with localStorage
server.express.use((req, res, next) => {
  const { token } = req.cookies;
  if (token) {
    // we include the app secret so noone messes with their cookie and sets
    // themself as an admin or something.
    const { userId } = jwt.verify(token, process.env.APP_SECRET);
    // put the user ID onto the request for future requests to access.
    req.userId = userId;
  }
  next();
});

// 2. Create a Middleware that populates the user on each request
server.express.use(async (req, res, next) => {
  // if they aren't logged in, skip this
  if (!req.userId) return next();
  const user = await db.query.user(
    { where: { id: req.userId } },
    "{id, permissions, email, name}"
  );
  req.user = user;
  next();
});

server.start(
  {
    cors: {
      credentials: true,
      origin: process.env.FRONTEND_URL,
    },
  },
  (deets) => {
    console.log(`Server is now running on port http:/localhost:${deets.port}`);
  }
);

//this is express
