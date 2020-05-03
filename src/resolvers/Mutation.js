//this is a GraphQL Yoga server file
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const Mutations = {
  async createItem(parent, args, ctx, info) {
    // TODO: Check if they are logged in

    //this is where we finally interact with our prisma API
    //  everything inside our db is everything in prims.graphql
    //in createServer.js we added the database to our context and thats how we access it here.
    // what will be return fron 'ctx.db.mut...' is a promise, so we will async/await
    const item = await ctx.db.mutation.createItem(
      {
        data: {
          ...args,
        },
      },
      info
    );
    // what is inside info parameter is the acutal query we will be receiving from the
    //    front end and specifies what we will be returning to the front end
    return item;
  },

  updateItem(parent, args, ctx, info) {
    //first take a copy of the updates
    const updates = { ...args };
    // remove the ID from the updates
    delete updates.id;
    // run the update method
    // we can see in prisma.graphql what arguments this method takes in
    // we make a copy of the updates because we to keep the original args, which
    // contains the original ID and this is what we will pass in for our 'where'
    return ctx.db.mutation.updateItem(
      {
        data: updates,
        where: {
          id: args.id,
        },
      },
      info
    );
  },

  async deleteItem(parent, args, ctx, info) {
    // 1. find the item
    const where = { id: args.id };
    const item = await ctx.db.query.item({ where }, `{id title}`);
    // TODO:
    // 2. Check if they own that item, or have the permission
    // 3. Delete it!
    return ctx.db.mutation.deleteItem({ where }, info);
  },

  async signup(parent, args, ctx, info) {
    args.email = args.email.toLowerCase();
    //now we need to hash their password.
    const password = await bcrypt.hash(args.password, 10);
    // create user in the DB
    // .createUser is being accessed from our prisma.graphql

    const user = await ctx.db.mutation.createUser(
      {
        data: {
          ...args,
          password,
          permissions: { set: ["USER"] },
        },
      },
      info
    );

    // create the JWT token for the new user
    //we need to pass in the app-secret from out .env file
    const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);
    // We set the jwt as a cookie on the response.
    // we are setting up httpOnly so it can't be written with JS.
    ctx.response.cookie("token", token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365, //1yr cookie
    });
    // We can now return the user to browser
    return user;
  },
};

module.exports = Mutations;

// Any time you put a mutation in here, it needs to mirror what is im
// the schema.graphql file.
