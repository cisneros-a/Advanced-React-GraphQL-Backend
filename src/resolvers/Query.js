//this is a GraphQL Yoga server file
// This is just a simple pull of data with no auth or filter.
//  if the query is the exact same from Yoga to Prisma, you can
// just forward the query to Prisma and it will handle the rest
const { forwardTo } = require("prisma-binding");
const Query = {
  items: forwardTo("db"),
  item: forwardTo("db"),
  itemsConnection: forwardTo("db"),
  // async items(parent, args, ctx, info) {
  //   const items = await ctx.db.query.items();
  //   return items;
  // },
};

module.exports = Query;

// This is where our database calls will go regardless of what
// database we are using the backend, but here we are using Prisma.
