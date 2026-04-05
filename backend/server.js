const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth');
const eligibilityRoutes = require('./routes/eligibility');
const credentialRoutes = require('./routes/credential');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/eligibility', eligibilityRoutes);
app.use('/api/credential', credentialRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Medical Eligibility Server running on port ${PORT}`);
});
