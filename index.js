import Express from 'express';
import fetch from  'node-fetch';
import bodyParser from 'body-parser';

import { graphqlExpress, graphiqlExpress } from 'apollo-server-express';
import { makeRemoteExecutableSchema, mergeSchemas, introspectSchema } from 'graphql-tools';
import { HttpLink } from 'apollo-link-http';

const STOCK_GRAPHQL_API_URL = 'http://localhost:8081/graphql'
const STOCK_PRICE_GRAPHQL_API_URL = 'http://localhost:8082/graphql'

async function run() {

  const createRemoteSchema = async (uri) => {
    const link = new HttpLink({uri: uri, fetch});
    const schema = await introspectSchema(link);
    return makeRemoteExecutableSchema({
      schema,
      link,
    });
  };

  const executableStockSchema = await createRemoteSchema(STOCK_GRAPHQL_API_URL);
  const executableStockPriceSchema = await createRemoteSchema(STOCK_PRICE_GRAPHQL_API_URL);

  const stockPriceResolvers = {
    StockDto: {
      stockPrice : {
        resolve(parent, args, context, info) {
          return info.mergeInfo.delegateToSchema({
            schema: executableStockPriceSchema,
            operation: 'query',
            fieldName: 'getStockPrice',
            args: {
              stockCode: parent.stockCode,
            },
            context,
            info,
          });
        },
      },
    },
  };

  const linkStockTypeDefs = `
    extend type StockDto {
      stockPrice: StockPriceDto,
    }
  `;

  const finalSchema = mergeSchemas({
    schemas: [
      executableStockSchema,
      executableStockPriceSchema,
      linkStockTypeDefs
    ],
    resolvers: stockPriceResolvers
  });

  const app = new Express();

  app.use('/graphql', bodyParser.json(), graphqlExpress({ schema: finalSchema}));

  app.use('/graphiql',graphiqlExpress({endpointURL: '/graphql'}));

  app.listen(8080);
  console.log('Server running. Open http://localhost:8080/graphiql to run queries.');
} // end of async run

try {
  run();
} catch (e) {
  console.log(e, e.message, e.stack);
}
