//this is a GraphQL Yoga server file
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
};

module.exports = Mutations;

// Any time you put a mutation in here, it needs to mirror what is im
// the schema.graphql file.
