'use strict';

require('dotenv').config();

const app = require('./app');

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log('╔══════════════════════════════════════════╗');
  console.log(`║  Fitness Challenge API                   ║`);
  console.log(`║  Server running on http://localhost:${PORT} ║`);
  console.log('╚══════════════════════════════════════════╝');
});
