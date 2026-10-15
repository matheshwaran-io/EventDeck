# EventDeck — Razorpay Payment Testing Guide (Test Mode)

> **Document Classification:** Official Testing & Verification Manual  
> **Target Environment:** Razorpay Test Mode (Sandbox) & EventDeck Local Payment Simulator  
> **Official Verification Date:** October 2026  
> **Primary Authority:** [Razorpay Official Documentation (Test Cards & Modes)](https://razorpay.com/docs/payments/payment-gateway/test-card-details/)  
> **Mandatory Security Rule:** Never enter real debit/credit card numbers, real bank account credentials, live UPI PINs, or live CVVs. Never switch the application to Live Mode (`rzp_live_…`) for testing.

---

## 1. Payment Integration Architecture in EventDeck

EventDeck implements a secure, server-authoritative payment flow designed to prevent client tampering, double-charging, and overselling:

```
[Participant]                   [EventDeck Client]             [EventDeck Server]            [Razorpay Gateway]
      │                                 │                              │                             │
   1. │ Selects ticket tier & qty       │                              │                             │
      ├────────────────────────────────▶│                              │                             │
   2. │ Clicks "Reserve & pay"          │                              │                             │
      │                                 ├─ POST /actions/bookings ────▶│ (Atomic seat reservation)   │
      │                                 │                              │ (10-min hold timer begins)  │
   3. │ Navigates to booking page       │                              │                             │
      │ (/my/bookings/[id])             │                              │                             │
   4. │ Clicks "Pay ₹XXX"               │                              │                             │
      │                                 ├─ POST /api/payments/order ──▶│                             │
      │                                 │                              ├─ POST /v1/orders ──────────▶│
      │                                 │                              │◀─ Returns rzp_order_id ─────┤
      │                                 │◀─ Returns CheckoutOrder ─────┤                             │
   5. │ Opens Razorpay Checkout Modal   │                              │                             │
      │ (checkout.js)                   ├───────────────────────────────────────────────────────────▶│
   6. │ Completes Test Mode payment     │                                                            │
      │ (Card / Netbanking / UPI)       │◀─ Returns payment_id & signature ──────────────────────────┤
   7. │ Submits verification payload    │                              │                             │
      │                                 ├─ POST /api/payments/verify ─▶│                             │
      │                                 │                              ├─ HMAC SHA-256 verify        │
      │                                 │                              ├─ Confirm payment (atomic)   │
      │                                 │                              ├─ Issue tickets & QR codes   │
      │                                 │◀─ 200 OK (Confirmed) ────────┤                             │
   8. │ Tickets displayed with QR & PDF │                              │                             │
```

### Key Security Safeguards:
1. **Server-Priced Orders:** The order amount is read strictly from `bookings.amount_paise` in the database. Any client-supplied amount or modified price is discarded.
2. **Signature Verification:** Client returns from checkout are never trusted without cryptographic validation. The server validates:
   $$\text{HMAC-SHA256}(\text{order\_id} \parallel \text{"|"} \parallel \text{payment\_id}, \text{RAZORPAY\_KEY\_SECRET})$$
3. **Asynchronous Webhook Redundancy:** Even if the user closes their browser immediately after payment, Razorpay's `payment.captured` webhook calls `/api/webhooks/razorpay`, verifies the webhook signature over the raw request body, deduplicates the delivery ID, and confirms the booking.
4. **Late Payment Protection:** If a payment completes after the 10-minute hold has lapsed:
   - If seats remain available, EventDeck automatically re-allocates them and issues tickets (`late_payment_recovered`).
   - If seats are sold out, the payment is recorded as a `payment_exception` and flagged in the administrator console for resolution (`/admin/exceptions`). A user is never left with an unrecorded charge.

---

## 2. Test Environment Setup

### 2.1. Environment Variables Configuration

To enable genuine Razorpay Test Mode checkout in `.env.local` or `.env.test`:

```ini
# Razorpay Test Mode API Credentials (Must start with rzp_test_)
RAZORPAY_KEY_ID=rzp_test_YOUR_TEST_KEY_ID
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_YOUR_TEST_KEY_ID
RAZORPAY_KEY_SECRET=YOUR_TEST_KEY_SECRET

# Razorpay Webhook Secret (Configured in Razorpay Dashboard -> Webhooks)
RAZORPAY_WEBHOOK_SECRET=YOUR_WEBHOOK_SECRET_STRING

# Disable local payment simulator when testing genuine Razorpay modal
ALLOW_MOCK_PAYMENTS=false
```

> **Live Key Guard:** In `src/lib/razorpay.ts`, if `RAZORPAY_KEY_ID` does not start with `rzp_test_`, the payment subsystem automatically forces `paymentMode()` to `"disabled"`. Live production keys are rejected by code contract.

### 2.2. Local Mock Simulator Setup (Alternative when keys are absent)

If Razorpay test keys have not been issued yet:
```ini
ALLOW_MOCK_PAYMENTS=true
```
When `ALLOW_MOCK_PAYMENTS=true` and `RAZORPAY_KEY_ID` is unset (or in non-production environments), EventDeck displays an interactive **Test Payment Simulator dialog** providing **Simulate Success** and **Simulate Decline** buttons that exercise the exact same server-side confirmation, state transitions, ticket issuance, and error handling as Razorpay.

---

## 3. Official Razorpay Test Cards (Indian & Domestic)

The following test cards are documented in official Razorpay technical documentation. They are simulated sandbox values that only work in Test Mode.

### 3.1. Standard Test Cards Reference Table

| Card Scenario / Network | Card Type | Card Sub-Type | Test Card Number | Expiry Date | CVV | Mock Page OTP Action | Expected Outcome |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Visa (Domestic India)** | Credit | Consumer | `4100 2800 0000 1007` | Any future date (e.g. `12/28`) | Any 3 digits (e.g. `123`) | Enter 4–10 digits OTP or click **Success** |  **Payment Success** (Status: `paid`, tickets issued) |
| **Visa (Domestic Alternative)** | Credit | Consumer | `4718 6091 0820 4366` | Any future date (e.g. `11/29`) | Any 3 digits (e.g. `456`) | Enter 4–10 digits OTP or click **Success** |  **Payment Success** (Status: `paid`, tickets issued) |
| **Mastercard (Domestic India)** | Credit | Business | `5555 5100 0008 1006` | Any future date (e.g. `10/28`) | Any 3 digits (e.g. `789`) | Enter 4–10 digits OTP or click **Success** |  **Payment Success** (Status: `paid`, tickets issued) |
| **Mastercard (Prepaid India)** | Prepaid | Consumer | `5180 2872 0009 1001` | Any future date (e.g. `08/29`) | Any 3 digits (e.g. `111`) | Enter 4–10 digits OTP or click **Success** |  **Payment Success** (Status: `paid`, tickets issued) |
| **RuPay (Domestic India)** | Credit | Consumer | `6527 6589 0000 1005` | Any future date (e.g. `07/28`) | Any 3 digits (e.g. `321`) | Enter 4–10 digits OTP or click **Success** |  **Payment Success** (Status: `paid`, tickets issued) |
| **American Express (Amex India)** | Credit | Consumer | `3402 560004 01007` | Any future date (e.g. `05/29`) | Any 4 digits (e.g. `1234`) | Enter 4–10 digits OTP or click **Success** |  **Payment Success** (Status: `paid`, tickets issued) |
| **Diners Club (Domestic India)** | Credit | Consumer | `3608 280009 1007` | Any future date (e.g. `09/28`) | Any 3 digits (e.g. `555`) | Enter 4–10 digits OTP or click **Success** |  **Payment Success** (Status: `paid`, tickets issued) |
| **Mastercard (International)** | Credit | Consumer | `5104 0155 5555 5558` | Any future date (e.g. `12/28`) | Any 3 digits (e.g. `999`) | Enter 4–10 digits OTP or click **Success** |  **Payment Success** (Status: `paid`, tickets issued) |
| **Mastercard Debit (International)**| Debit | Consumer | `5104 0600 0000 0008` | Any future date (e.g. `12/28`) | Any 3 digits (e.g. `888`) | Enter 4–10 digits OTP or click **Success** |  **Payment Success** (Status: `paid`, tickets issued) |

---

## 4. Payment Failure & Error Simulation Scenarios

### 4.1. Error Simulation Cards & Mapped Error Codes

| Scenario | Network | Test Card Number | Expiry & CVV | Action on Mock Bank Page | Triggered Error Code / Message | Expected System Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Insufficient Account Balance** | Visa | `4100 2800 0008 0001` | Future / Any 3 digits | Click **Failure** button | `insufficient_fund` (*Insufficient account balance*) | Checkout displays error banner; booking remains in `awaiting_payment` with status `failed`; retry button enabled. |
| **Alternative Insufficient Balance** | Mastercard | `5305 6200 0005 0001` | Future / Any 3 digits | Click **Failure** button | `insufficient_fund` | Modal notifies user; reservation hold preserved. |
| **Authentication / OTP Failure** | Any valid test card | (Any standard card above) | Future / Any 3 digits | Enter OTP with **fewer than 4 digits** (e.g., `12`) | `authentication_failed` | Bank page rejects submission; transaction marked failed. |
| **Bank / Network Decline** | Any valid test card | (Any standard card above) | Future / Any 3 digits | Click **Failure** button on mock screen | `card_declined` (*Payment declined by bank*) | Payment rejected; user receives descriptive error toast; retry allowed. |
| **Expired Card Entry** | Standard card | Any card | Past date (e.g. `01/22`) | (Blocked at checkout input) | `card_expired` | Razorpay Checkout client-side validator refuses to proceed. |
| **Invalid CVV Entry** | Standard card | Any card | Future / `< 3` digits | (Blocked at checkout input) | `invalid_cvv` | Client-side input validation refuses submission. |

---

## 5. Indian Netbanking Simulation Testing

In Razorpay Test Mode, Netbanking transactions do not require or accept actual bank login credentials.

### 5.1. Netbanking Test Procedure:
1. Log in as a Participant (`participant@eventdeck.test` or newly registered user).
2. Choose a paid event (e.g., `Raag & Rhythm` or `Inter-College Football Cup — Finals`).
3. Select ticket tier and quantity (e.g., 1 Stands ticket = ₹49.00) and click **Reserve & pay**.
4. On `/my/bookings/[id]`, review the 10-minute hold countdown timer and click **Pay ₹49.00**.
5. When Razorpay Checkout modal appears, select **Netbanking**.
6. The modal displays popular Indian banks:
   - State Bank of India (SBI)
   - HDFC Bank
   - ICICI Bank
   - Axis Bank
   - Kotak Mahindra Bank
   - Punjab National Bank (PNB)
   - Or search any scheduled Indian commercial bank.
7. Click any bank name and click **Pay**.
8. Razorpay automatically redirects to a **Simulated Bank Authentication Page** (`api.razorpay.com/v1/payments/.../mock`):
   - Notice: The page clearly displays a sandbox banner and two primary buttons: **Success** and **Failure**.
   - **Do not look for account number or Netbanking password inputs; this is a sandbox simulation.**
9. **To Test Success:**
   - Click the **Success** button.
   - The browser redirects back to EventDeck with the Razorpay payment response.
   - `/api/payments/verify` verifies the signature.
   - Page refreshes to display: Status **Approved**, Payment **Paid**, and the downloadable PDF Ticket with QR codes.
10. **To Test Failure:**
    - Repeat steps 1–8, and on the mock bank screen, click **Failure**.
    - The browser returns to EventDeck.
    - An error toast appears: *"Payment failed. You can try again."*
    - The booking status reflects *"Your last payment attempt didn't go through. You can try again."*
    - Inventory hold remains active until the timer expires.

---

## 6. UPI Simulation Testing

If UPI is displayed in the Razorpay Checkout modal:

### 6.1. UPI Test VPAs (Virtual Payment Addresses):
* **`success@razorpay`**: Simulates an instantly approved UPI intent / collect transaction.
  - Enter `success@razorpay` in the UPI ID field.
  - Click **Pay**.
  - Checkout resolves successfully; `/api/payments/verify` confirms the order.
* **`failure@razorpay`**: Simulates a rejected UPI payment request.
  - Enter `failure@razorpay`.
  - Click **Pay**.
  - Checkout triggers `payment.failed`, notifies the server via `/api/payments/failed`, and displays the retry interface.

---

## 7. Modal Interruption & Timeout Scenarios

| Scenario | Tester Action | Expected Behavior |
| :--- | :--- | :--- |
| **User Closes Checkout Modal** | Click the 'X' icon or click outside the modal during payment | `modal.ondismiss` callback triggers. A notification appears: *"Payment window closed. Your seats stay held until the timer runs out."* Booking remains in `awaiting_payment`. |
| **Network Interruption During Payment** | Simulate offline state via DevTools Network tab during submission | Checkout displays connection error. Booking remains held. User can reload and click **Pay** again. |
| **Reservation Timer Expires (10 min)** | Let countdown timer reach `00:00` on `/my/bookings/[id]` | Timer changes to *"Reservation expired"*. Action buttons are disabled. Seats are returned to `ticket_tiers.allocated`. If user attempts to create order, server returns 409: *"Your reservation is about to expire. Please start a new booking."* |
| **Duplicate Payment Submission** | Rapid double-click on payment confirmation or simultaneous webhook + callback | Server uses Postgres row locking (`for update`) on `payments` and `bookings`. First confirmation wins and marks order `paid`; duplicate delivery is identified (`duplicate_payment`), logged in audit logs, and does not create duplicate tickets. |

---

## 8. Webhook Verification & Testing

EventDeck includes a dedicated, signature-verified webhook handler at `/api/webhooks/razorpay`.

### 8.1. Webhook Configuration in Razorpay Dashboard
1. Switch Razorpay Dashboard to **Test Mode**.
2. Navigate to **Settings** → **Webhooks** → **Add New Webhook**.
3. **Webhook URL:** `https://your-domain.com/api/webhooks/razorpay` (or your ngrok / tunnel URL during local testing).
4. **Secret:** Enter a strong secret string (and set it as `RAZORPAY_WEBHOOK_SECRET` in `.env.local`).
5. **Active Events:**
   - `payment.captured`
   - `order.paid`
   - `payment.failed`
   - `refund.processed`
   - `refund.failed`
6. Click **Save**.

### 8.2. Webhook Delivery Verification Procedure:
1. Trigger a payment using any test card.
2. Inspect the **Webhook Logs** in Razorpay Dashboard:
   - Check that the HTTP response code is `200 OK`.
   - Response body: `{"ok":true,"outcome":"confirmed"}` (or `"already_processed"` if checkout callback arrived first).
3. Verify in PostgreSQL database:
   ```sql
   SELECT event_id, event_type, outcome, received_at FROM webhook_events ORDER BY received_at DESC LIMIT 5;
   ```
   Confirm that the event ID is stored and deduplicated.

---

## 9. Refund Verification Testing (Cancelled Events)

Refunds in EventDeck are initiated by the system when an administrator cancels an event with paid bookings.

### 9.1. Cancellation & Refund Test Flow:
1. Ensure a paid booking exists for an upcoming event (e.g., `Inter-College Football Cup`).
2. Log in as **Event Organizer** (`organizer@eventdeck.test`).
3. Navigate to event dashboard → Click **Request cancellation** → Provide explanation: *"Inclement weather forces tournament rescheduling"* → Submit.
4. Log in as **Administrator** (`admin@eventdeck.test`).
5. Navigate to **Administration** → **Cancellations** (`/admin/cancellations`).
6. Click **Approve cancellation**.
   - System updates event status to `cancelled`.
   - Tickets are marked `invalidated`.
   - Bookings update to `event_cancelled` with `refund_status: 'pending'`.
   - Entries are automatically created in the `refunds` table.
7. Navigate to **Administration** → **Refunds** (`/admin/refunds`).
8. The pending refund is listed with the Razorpay Payment ID and amount.
9. Click **Process refund** (or **Process all pending**):
   - In Razorpay Test Mode, the server calls `POST /v1/payments/{paymentId}/refund`.
   - The test refund is registered in Razorpay sandbox.
   - Status updates to `processed` (or awaits `refund.processed` webhook).
10. Log in as the Participant:
    - Visit `/my/bookings/[id]`.
    - Status displays **Event cancelled** and **Refund processed**.

---

## 10. Verification Checklist in Database & Dashboard

After running payment tests, verify integrity across these database tables:

```sql
-- 1. Verify payment record
SELECT order_id, payment_id, amount_paise, provider, status, signature_verified, confirmed_via 
FROM payments WHERE booking_id = 'YOUR_BOOKING_ID';

-- 2. Verify booking status
SELECT reference, status, payment_status, refund_status, quantity, amount_paise 
FROM bookings WHERE id = 'YOUR_BOOKING_ID';

-- 3. Verify issued tickets
SELECT ticket_number, qr_token, status, attendee_name 
FROM tickets WHERE booking_id = 'YOUR_BOOKING_ID';

-- 4. Verify inventory allocation
SELECT name, capacity, allocated 
FROM ticket_tiers WHERE event_id = 'YOUR_EVENT_ID';

-- 5. Verify audit log entry
SELECT action, entity_type, entity_id, details, created_at 
FROM audit_logs WHERE entity_id = 'YOUR_BOOKING_ID' OR details->>'reference' = 'YOUR_REFERENCE';
```
