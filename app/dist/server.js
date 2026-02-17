require('dotenv').config();

const express = require('express');
const path = require('path');
const { createMollieClient } = require('@mollie/api-client');

const app = express();
const PORT = process.env.PORT || 3001;

const mollieClient = createMollieClient({ apiKey: process.env.MOLLIE_API_KEY });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(__dirname));

// POST /api/create-payment
app.post('/api/create-payment', async (req, res) => {
  try {
    const { amount, description, redirectUrl, concertDate, venue, location, ticketType } = req.body;

    const value = parseFloat(amount).toFixed(2);

    const payment = await mollieClient.payments.create({
      amount: {
        currency: 'EUR',
        value,
      },
      description,
      redirectUrl,
      webhookUrl: process.env.WEBHOOK_URL,
      metadata: {
        concertDate,
        venue,
        location,
        ticketType,
      },
    });

    res.json({
      checkoutUrl: payment.getCheckoutUrl(),
      paymentId: payment.id,
    });
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({ error: 'Failed to create payment', details: error.message });
  }
});

// GET /api/payment-status/:id
app.get('/api/payment-status/:id', async (req, res) => {
  try {
    const payment = await mollieClient.payments.get(req.params.id);
    res.json({
      status: payment.status,
      success: payment.status === 'paid',
    });
  } catch (error) {
    console.error('Error getting payment status:', error);
    res.status(500).json({ error: 'Failed to get payment status', details: error.message });
  }
});

// POST /api/webhook — Mollie payment webhook
app.post('/api/webhook', async (req, res) => {
  try {
    const { id } = req.body;
    if (id) {
      const payment = await mollieClient.payments.get(id);
      console.log(`Webhook: payment ${id} status = ${payment.status}`);
    }
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    // Always return 200 so Mollie stops retrying
    res.status(200).send('OK');
  }
});

// SPA fallback — serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
