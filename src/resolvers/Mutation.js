//this is a GraphQL Yoga server file
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { randomBytes } = require("crypto");
const { hasPermission } = require("../utils");

//node has functions in a util mdoule. Promsify will turn function with callbacks
// to promise functions/
const { promisify } = require("util");
const { transport, makeANiceEmail } = require("../mail");

const Mutations = {
  async createItem(parent, args, ctx, info) {
    // TODO: Check if they are logged in
    if (!ctx.request.userId) {
      throw new Error("You must be logged in to do that!");
    }
    //this is where we finally interact with our prisma API
    //  everything inside our db is everything in prims.graphql
    //in createServer.js we added the database to our context and thats how we access it here.
    // what will be return fron 'ctx.db.mut...' is a promise, so we will async/await
    const item = await ctx.db.mutation.createItem(
      {
        data: {
          //this is how we create a relationship between item and user.
          user: {
            connect: {
              id: ctx.request.userId,
            },
          },
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
    const item = await ctx.db.query.item({ where }, `{id title user { id }}`);
    // TODO:
    // 2. Check if they own that item, or have the permission
    const ownsItem = item.user.id === ctx.request.userId;
    const hasPermissions = ctx.request.user.permissions.some((permission) =>
      ["Admin", "ITEMDELETE"].includes(permission)
    );
    if (!ownsItem && !hasPermissions) {
      throw new Error("You don't have permission to do that!");
    }
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

  async signin(parent, { email, password }, ctx, info) {
    // 1. check if there is a user with that email
    const user = await ctx.db.query.user({
      where: { email },
    });

    if (!user) {
      throw new Error(`No such user found for email ${email}`);
    }
    // 2. Check if their password is correct
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new Error("Invalid Password!");
    }
    // 3. generate the JWT Token
    const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);
    // 4. Set the cookie with the token
    ctx.response.cookie("token", token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365,
    });
    // 5. Return the user
    return user;
  },

  signout(parent, args, ctx, info) {
    ctx.response.clearCookie("token");
    return { message: "Goodbye!" };
  },

  async requestReset(parent, args, ctx, info) {
    //1. check if this is a real user.
    const users = await ctx.db.query.users({
      where: { email: args.email },
    });
    const user = users[0];
    if (!user) {
      throw new Error(`No such user found for email ${args.email}`);
    }
    //2. set a reset token and expiry on that user
    const randomBytesPromisified = promisify(randomBytes);
    const resetToken = (await randomBytesPromisified(20)).toString("hex");
    const resetTokenExpiry = Date.now() + 3600000; //1hr from now
    const res = await ctx.db.mutation.updateUser({
      where: { email: args.email },
      data: { resetToken, resetTokenExpiry },
    });
    return { message: "Thanks!" };
    //3. email them that reset token
  },

  async requestReset(parent, args, ctx, info) {
    // 1. Check if this is a real user
    const user = await ctx.db.query.user({ where: { email: args.email } });
    if (!user) {
      throw new Error(`No such user found for email ${args.email}`);
    }
    // 2. Set a reset token and expiry on that user
    const randomBytesPromiseified = promisify(randomBytes);
    const resetToken = (await randomBytesPromiseified(20)).toString("hex");
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour from now
    const res = await ctx.db.mutation.updateUser({
      where: { email: args.email },
      data: { resetToken, resetTokenExpiry },
    });
    // 3. Email them that reset token
    const mailRes = await transport.sendMail({
      from: "adrian.cis45@gmail.com",
      to: user.email,
      subject: "Your password reset",
      html: makeANiceEmail(`Your Password Reset Token is here!
   \n\n 
   <a href="${process.env.FRONTEND_URL}/reset?resetToken=${resetToken}
   ">Click HERE to Reset</a> `),
    });

    //4 return the messsage
    return { message: "Thanks!" };
  },

  async resetPassword(parent, args, ctx, info) {
    // 1. check if the passwords match
    if (args.password !== args.confirmPassword) {
      throw new Error("Yo Passwords don't match!");
    }
    // 2. check if its a legit reset token
    // 3. Check if its expired
    const [user] = await ctx.db.query.users({
      where: {
        resetToken: args.resetToken,
        resetTokenExpiry_gte: Date.now() - 3600000,
      },
    });
    if (!user) {
      throw new Error("This token is either invalid or expired!");
    }
    // 4. Hash their new password
    const password = await bcrypt.hash(args.password, 10);
    // 5. Save the new password to the user and remove old resetToken fields
    const updatedUser = await ctx.db.mutation.updateUser({
      where: { email: user.email },
      data: {
        password,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });
    // 6. Generate JWT
    const token = jwt.sign({ userId: updatedUser.id }, process.env.APP_SECRET);
    // 7. Set the JWT cookie
    ctx.response.cookie("token", token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365,
    });
    // 8. return the new user
    return updatedUser;
  },

  async updatePermissions(parent, args, ctx, info) {
    //1. Check if they are logged in.

    if (!ctx.request.userId) {
      throw new Error("You must be logged in to do this");
    }
    //2. Query the current user
    const currentUser = await ctx.db.query.user(
      {
        where: { id: ctx.request.userId },
      },
      info
    );
    //3. Check if they have permission to do this
    hasPermission(currentUser, ["ADMIN", "PERMISSIONUPDATE"]);
    //4. Update the permissions
    return ctx.db.mutation.updateUser(
      {
        data: {
          //we are nesting set because Enum is Permissions and that will also be the name
          // of the argument we will be getting so we have to add a nested object, set.
          permissions: {
            set: args.permissions,
          },
        },
        // the reason we are not using ctx.db.userId
        // is because we may be updating someone else's permissions
        where: {
          id: args.userId,
        },
      },
      info
    );
  },

  async addToCart(parent, args, ctx, info) {
    //1 make sure they are signed in
    const { userId } = ctx.request;
    if (!userId) {
      throw new Error("You must be logged in!");
    }
    //2 Query the users current cart
    //we are doing the query for all the items and then just returning the first one
    // this is because the search for all items is more robust if you look at prisma.graphql
    const [existingCartItem] = await ctx.db.query.cartItems({
      where: {
        user: { id: userId },
        item: { id: args.id },
      },
    });
    //3 Check if the item is already in the cart
    if (existingCartItem) {
      console.log("This item is already in the cart");
      return ctx.db.mutation.updateCartItem(
        {
          where: { id: existingCartItem.id },
          data: { quantity: existingCartItem.quantity + 1 },
        },
        info
      );
    }
    console.log("This item is not in the cart");

    //4. If it is not in the cart, add the item
    return ctx.db.mutation.createCartItem(
      {
        data: {
          user: {
            connect: { id: userId },
          },
          item: {
            connect: { id: args.id },
          },
        },
      },
      info
    );
  },
};

module.exports = Mutations;

// Any time you put a mutation in here, it needs to mirror what is im
// the schema.graphql file.
