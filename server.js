require('dotenv').config();

const express = require('express');
const { PORT, BASE_PATH, LOG_LEVEL } = require('./server/config');
const { igCookieMiddleware } = require('./server/middleware/requestContext');
const { requestLogger } = require('./server/middleware/requestLogger');
const { registerRoutes } = require('./server/routes');
const { logger } = require('./server/utils/logger');

const app = express();

app.use(igCookieMiddleware);
app.use(requestLogger);
registerRoutes(app);

app.listen(PORT, () => {
  logger.info('server', 'listening', {
    url: `http://localhost:${PORT}${BASE_PATH || ''}`,
    logLevel: LOG_LEVEL
  });
});
