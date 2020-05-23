//this is a GraphQL Yoga server file
// This is just a simple pull of data with no auth or filter.
//  if the query is the exact same from Yoga to Prisma, you can
// just forward the query to Prisma and it will handle the rest
const { forwardTo } = require("prisma-binding");
const Query = {
  items: forwardTo("db"),
  item: forwardTo("db"),
  itemsConnection: forwardTo("db"),
  user: forwardTo("db"),
  me(parent, args, ctx, info) {
    //The only way to access the request that is in server.js is to use ctx here.
    // Keep in mind that it needs to be fully typed out request.
    if (!ctx.request.userId) {
      return null;
    }
    return ctx.db.query.user(
      {
        where: { id: ctx.request.userId },
      },
      info
    );
  },
};

module.exports = Query;

// This is where our database calls will go regardless of what
// database we are using the backend, but here we are using Prisma.
