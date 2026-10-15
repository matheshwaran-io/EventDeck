import { chromium } from "@playwright/test";
import * as path from "node:path";
import * as fs from "node:fs";

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>EventDeck — Test Account Credentials & Razorpay Payment Testing Guide</title>
<style>
  @page {
    size: A4;
    margin: 10mm 12mm 10mm 12mm;
  }
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1e293b;
    background: #ffffff;
    font-size: 8.8pt;
    line-height: 1.38;
  }
  .page {
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .page-break {
    page-break-before: always;
  }
  .header {
    border-bottom: 2px solid #0f172a;
    padding-bottom: 8px;
    margin-bottom: 10px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .title-group h1 {
    font-size: 16pt;
    font-weight: 800;
    color: #0f172a;
    letter-spacing: -0.4px;
    margin-bottom: 2px;
  }
  .title-group p {
    font-size: 9pt;
    color: #475569;
    font-weight: 500;
  }
  .meta-box {
    text-align: right;
    font-size: 7.5pt;
    color: #64748b;
  }
  .badge-env {
    display: inline-block;
    background: #e0f2fe;
    color: #0369a1;
    font-weight: 700;
    font-size: 7pt;
    padding: 2px 6px;
    border-radius: 4px;
    margin-bottom: 2px;
    text-transform: uppercase;
  }
  .notice {
    background: #f8fafc;
    border-left: 3px solid #3b82f6;
    padding: 6px 10px;
    border-radius: 0 5px 5px 0;
    font-size: 8pt;
    color: #334155;
    margin-bottom: 10px;
  }
  .notice strong {
    color: #0f172a;
  }
  .warning-box {
    background: #fffbeb;
    border-left: 3px solid #f59e0b;
    padding: 5px 8px;
    border-radius: 0 4px 4px 0;
    font-size: 7.5pt;
    color: #92400e;
    margin-top: 6px;
  }
  h2 {
    font-size: 10.5pt;
    font-weight: 700;
    color: #0f172a;
    margin-top: 8px;
    margin-bottom: 5px;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 3px;
    display: flex;
    align-items: center;
    gap: 5px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 8px;
    font-size: 8pt;
  }
  th {
    background: #f1f5f9;
    color: #0f172a;
    text-align: left;
    padding: 4.5px 7px;
    font-weight: 600;
    border: 1px solid #cbd5e1;
    font-size: 7.5pt;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  td {
    padding: 4px 7px;
    border: 1px solid #e2e8f0;
    vertical-align: middle;
  }
  tr:nth-child(even) td {
    background: #f8fafc;
  }
  .code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 7.5pt;
    background: #f1f5f9;
    padding: 1.5px 4px;
    border-radius: 3px;
    color: #0f172a;
    font-weight: 600;
  }
  .card-num {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 8pt;
    font-weight: 700;
    color: #1e3a8a;
    letter-spacing: 0.4px;
    white-space: nowrap;
  }
  .badge-role {
    display: inline-block;
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 7pt;
    font-weight: 700;
    text-transform: uppercase;
  }
  .role-admin { background: #fee2e2; color: #991b1b; }
  .role-org { background: #e0e7ff; color: #3730a3; }
  .role-mod { background: #fef3c7; color: #92400e; }
  .role-user { background: #dcfce7; color: #166534; }
  .badge-status {
    display: inline-block;
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 7pt;
    font-weight: 600;
  }
  .status-pass { background: #dcfce7; color: #15803d; }
  .status-fail { background: #fee2e2; color: #b91c1c; }
  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 6px;
  }
  .panel {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 5px;
    padding: 7px 10px;
  }
  .panel h3 {
    font-size: 8.5pt;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .panel p, .panel li {
    font-size: 7.5pt;
    color: #475569;
    line-height: 1.35;
  }
  .panel ul, .panel ol {
    padding-left: 12px;
    margin-top: 3px;
  }
  .panel li {
    margin-bottom: 2px;
  }
  .footer-note {
    padding-top: 6px;
    border-top: 1px solid #e2e8f0;
    font-size: 7pt;
    color: #94a3b8;
    text-align: center;
  }
</style>
</head>
<body>

  <!-- ==================== PAGE 1 ==================== -->
  <div class="page">
    <div>
      <div class="header">
        <div class="title-group">
          <h1>EventDeck — Credentials &amp; Role QA Reference</h1>
          <p>Role-Based Test Account Inventory &amp; Authorization Boundaries</p>
        </div>
        <div class="meta-box">
          <div class="badge-env">Sandbox / Test Mode</div>
          <div>Verified: October 2026</div>
          <div>Page 1 of 2</div>
        </div>
      </div>

      <div class="notice">
        <strong>Security &amp; Environment Rule:</strong> All accounts below are pre-configured for <strong>Local Development, Staging, and Test environments</strong>. Password equals <span class="code">SEED_DEMO_PASSWORD</span> defined in <span class="code">.env.local</span>. Never enter real banking credentials or live production passwords.
      </div>

      <h2>👥 1. Role-Based Test Account Inventory</h2>
      <table>
        <thead>
          <tr>
            <th style="width: 16%;">Role</th>
            <th style="width: 27%;">Test Email</th>
            <th style="width: 18%;">Password Source</th>
            <th style="width: 24%;">Affiliation / Category</th>
            <th style="width: 15%;">Key Portal</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><span class="badge-role role-admin">System Admin</span></td>
            <td><span class="code">admin@eventdeck.test</span></td>
            <td><code>SEED_DEMO_PASSWORD</code></td>
            <td>Staff (SRM IST KTR Staff)</td>
            <td><code>/admin</code></td>
          </tr>
          <tr>
            <td><span class="badge-role role-admin">Root Admin</span></td>
            <td><span class="code">eventdeck88@gmail.com</span></td>
            <td>Configured in Supabase</td>
            <td>Staff (Permanent Root Admin)</td>
            <td><code>/admin</code> (Protected)</td>
          </tr>
          <tr>
            <td><span class="badge-role role-org">Organizer</span></td>
            <td><span class="code">organizer@eventdeck.test</span></td>
            <td><code>SEED_DEMO_PASSWORD</code></td>
            <td>Faculty (Dept. Computing Tech)</td>
            <td><code>/organizer</code></td>
          </tr>
          <tr>
            <td><span class="badge-role role-org">Organizer</span></td>
            <td><span class="code">cultural@eventdeck.test</span></td>
            <td><code>SEED_DEMO_PASSWORD</code></td>
            <td>Student (Directorate Student Affairs)</td>
            <td><code>/organizer</code></td>
          </tr>
          <tr>
            <td><span class="badge-role role-mod">Moderator</span></td>
            <td><span class="code">participant@eventdeck.test</span></td>
            <td><code>SEED_DEMO_PASSWORD</code></td>
            <td>Assigned to <em>Orientation Mixer</em></td>
            <td><code>/moderate</code></td>
          </tr>
          <tr>
            <td><span class="badge-role role-user">Participant</span></td>
            <td><span class="code">participant@eventdeck.test</span></td>
            <td><code>SEED_DEMO_PASSWORD</code></td>
            <td>SRM Student (Host Student, CSE)</td>
            <td><code>/my/bookings</code></td>
          </tr>
          <tr>
            <td><span class="badge-role role-user">Participant</span></td>
            <td><span class="code">guest@eventdeck.test</span></td>
            <td><code>SEED_DEMO_PASSWORD</code></td>
            <td>External Student (Loyola College)</td>
            <td><code>/my/bookings</code></td>
          </tr>
          <tr>
            <td><span class="badge-role role-user">Participant</span></td>
            <td><span class="code">aditi@eventdeck.test</span></td>
            <td><code>SEED_DEMO_PASSWORD</code></td>
            <td>SRM Student (Holds active reservation)</td>
            <td><code>/my/bookings</code></td>
          </tr>
          <tr>
            <td><span class="badge-role role-user">Applicant</span></td>
            <td><span class="code">applicant@eventdeck.test</span></td>
            <td><code>SEED_DEMO_PASSWORD</code></td>
            <td>SRM Student (Organizer applicant)</td>
            <td><code>/my/profile</code></td>
          </tr>
        </tbody>
      </table>

      <h2>🛡️ 2. Role Provisioning &amp; Authorization Rules</h2>
      <div class="grid-2">
        <div class="panel">
          <h3>⚡ Admin CLI Bootstrap Command</h3>
          <p>Administrative rights cannot be obtained via the web app. Run from a secure shell with database access:</p>
          <p style="margin-top: 3px;"><span class="code">ADMIN_EMAIL=you@domain.edu ADMIN_PASSWORD=Pass123! npm run admin:create</span></p>
          <ul>
            <li>Creates user in Supabase Auth with <code>email_confirm: true</code>.</li>
            <li>Promotes <code>profiles.role</code> to <code>admin</code> and logs action.</li>
            <li>If password is omitted, generates a 16-char secure string.</li>
          </ul>
        </div>
        <div class="panel">
          <h3>🎯 Event-Scoped Check-in Moderator</h3>
          <p>Moderator is <strong>not</strong> a global platform enum in <code>profiles.role</code>:</p>
          <ul>
            <li>Organizer delegates any active user at <code>/organizer/events/[id]/team</code>.</li>
            <li>Delegated user receives <strong>Check-in</strong> navbar link and scanner at <code>/moderate/[id]</code>.</li>
            <li>Max <strong>10 active moderators</strong> per event. Immediate revocation.</li>
            <li>Restricted from all organizer edits, pass reviews, and financial modules.</li>
          </ul>
        </div>
      </div>

      <div class="grid-2">
        <div class="panel">
          <h3>🔒 Root Admin Permanent Guarantee</h3>
          <p><span class="code">eventdeck88@gmail.com</span> is hardcoded in <code>src/lib/constants.ts</code> and <code>src/lib/auth.ts</code>. It is unconditionally active and an administrator. UI actions attempting to demote or deactivate this account are rejected with an explicit security error.</p>
        </div>
        <div class="panel">
          <h3>🎓 SRM Domain Validation Rule</h3>
          <p>Students claiming SRM affiliation must provide an official email matching <span class="code">@srmist.edu.in</span> or <span class="code">@srmuniv.ac.in</span> (or test domain <span class="code">@eventdeck.test</span>). Non-SRM domains claiming student status are rejected by server validation (<code>drizzle/0003</code>).</p>
        </div>
      </div>
    </div>

    <div class="footer-note">
      EventDeck University Event Management System · Technical Testing Documentation · Page 1 of 2
    </div>
  </div>

  <!-- ==================== PAGE 2 ==================== -->
  <div class="page page-break">
    <div>
      <div class="header">
        <div class="title-group">
          <h1>EventDeck — Razorpay Payment Testing Guide</h1>
          <p>Official Sandbox Test Cards, Netbanking &amp; Error Simulation</p>
        </div>
        <div class="meta-box">
          <div class="badge-env">Razorpay Sandbox</div>
          <div>Verified: October 2026</div>
          <div>Page 2 of 2</div>
        </div>
      </div>

      <h2>💳 3. Official Razorpay Test Cards (Indian &amp; Domestic)</h2>
      <p style="font-size: 7.5pt; color: #475569; margin-bottom: 4px;">
        Verified against official Razorpay Test Mode documentation (<code>razorpay.com/docs</code>). No real funds ever move.
      </p>
      <table>
        <thead>
          <tr>
            <th style="width: 26%;">Card Network / Scenario</th>
            <th style="width: 14%;">Type</th>
            <th style="width: 25%;">Test Card Number</th>
            <th style="width: 12%;">Expiry</th>
            <th style="width: 8%;">CVV</th>
            <th style="width: 15%;">Mock Bank Action</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Visa Domestic (India)</strong></td>
            <td>Credit</td>
            <td><span class="card-num">4100 2800 0000 1007</span></td>
            <td>Future (12/28)</td>
            <td>123</td>
            <td><span class="badge-status status-pass">Success (OTP 4-10)</span></td>
          </tr>
          <tr>
            <td><strong>Visa Domestic (Alternative)</strong></td>
            <td>Credit</td>
            <td><span class="card-num">4718 6091 0820 4366</span></td>
            <td>Future (11/29)</td>
            <td>456</td>
            <td><span class="badge-status status-pass">Success (OTP 4-10)</span></td>
          </tr>
          <tr>
            <td><strong>Mastercard Domestic</strong></td>
            <td>Credit</td>
            <td><span class="card-num">5555 5100 0008 1006</span></td>
            <td>Future (10/28)</td>
            <td>789</td>
            <td><span class="badge-status status-pass">Success (OTP 4-10)</span></td>
          </tr>
          <tr>
            <td><strong>Mastercard Prepaid</strong></td>
            <td>Prepaid</td>
            <td><span class="card-num">5180 2872 0009 1001</span></td>
            <td>Future (08/29)</td>
            <td>111</td>
            <td><span class="badge-status status-pass">Success (OTP 4-10)</span></td>
          </tr>
          <tr>
            <td><strong>RuPay Domestic</strong></td>
            <td>Credit</td>
            <td><span class="card-num">6527 6589 0000 1005</span></td>
            <td>Future (07/28)</td>
            <td>321</td>
            <td><span class="badge-status status-pass">Success (OTP 4-10)</span></td>
          </tr>
          <tr>
            <td><strong>American Express (Amex)</strong></td>
            <td>Credit</td>
            <td><span class="card-num">3402 560004 01007</span></td>
            <td>Future (05/29)</td>
            <td><strong>1234</strong></td>
            <td><span class="badge-status status-pass">Success (4-digit CVV)</span></td>
          </tr>
          <tr>
            <td><strong>Diners Club Domestic</strong></td>
            <td>Credit</td>
            <td><span class="card-num">3608 280009 1007</span></td>
            <td>Future (09/28)</td>
            <td>555</td>
            <td><span class="badge-status status-pass">Success (OTP 4-10)</span></td>
          </tr>
          <tr>
            <td><strong>Mastercard International</strong></td>
            <td>Credit</td>
            <td><span class="card-num">5104 0155 5555 5558</span></td>
            <td>Future (12/28)</td>
            <td>999</td>
            <td><span class="badge-status status-pass">Success (OTP 4-10)</span></td>
          </tr>
          <tr>
            <td><strong>Mastercard Debit Int'l</strong></td>
            <td>Debit</td>
            <td><span class="card-num">5104 0600 0000 0008</span></td>
            <td>Future (12/28)</td>
            <td>888</td>
            <td><span class="badge-status status-pass">Success (OTP 4-10)</span></td>
          </tr>
        </tbody>
      </table>

      <h2>⚠️ 4. Error Simulation Cards &amp; Decline Scenarios</h2>
      <table>
        <thead>
          <tr>
            <th style="width: 25%;">Failure Scenario</th>
            <th style="width: 25%;">Test Card Number</th>
            <th style="width: 20%;">Mock Bank Action</th>
            <th style="width: 30%;">Result &amp; System Behavior</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Insufficient Balance</strong></td>
            <td><span class="card-num">4100 2800 0008 0001</span></td>
            <td>Click <strong>Failure</strong> button</td>
            <td>Triggers <code>insufficient_fund</code>. Toast error shown; seats held.</td>
          </tr>
          <tr>
            <td><strong>Alt Insufficient Funds</strong></td>
            <td><span class="card-num">5305 6200 0005 0001</span></td>
            <td>Click <strong>Failure</strong> button</td>
            <td>Triggers <code>insufficient_fund</code>. Status remains <code>awaiting_payment</code>.</td>
          </tr>
          <tr>
            <td><strong>OTP / Auth Failure</strong></td>
            <td>Any standard card above</td>
            <td>Enter OTP <strong>&lt; 4 digits</strong> (e.g. <code>12</code>)</td>
            <td>Triggers <code>authentication_failed</code>. Decline captured; seats preserved.</td>
          </tr>
          <tr>
            <td><strong>Bank / Issuer Decline</strong></td>
            <td>Any standard card above</td>
            <td>Click <strong>Failure</strong> on bank screen</td>
            <td>Triggers <code>card_declined</code>. Booking payment status = <code>failed</code>.</td>
          </tr>
          <tr>
            <td><strong>Modal Interruption</strong></td>
            <td>Click 'X' / Dismiss modal</td>
            <td><code>modal.ondismiss</code> fires</td>
            <td>Toast: <em>Seats stay held until timer ends</em> (10-min hold active).</td>
          </tr>
        </tbody>
      </table>

      <h2>🏦 5. Netbanking, UPI &amp; Local Simulator Procedures</h2>
      <div class="grid-2">
        <div class="panel">
          <h3>🏛️ Indian Netbanking Simulation</h3>
          <ol>
            <li>On <code>/my/bookings/[id]</code>, click <strong>Pay ₹...</strong>.</li>
            <li>Select <strong>Netbanking</strong> in Razorpay checkout.</li>
            <li>Choose any bank: <strong>SBI, HDFC, ICICI, Axis, Kotak</strong>.</li>
            <li>Opens simulated mock bank page with <strong>Success</strong> &amp; <strong>Failure</strong>.</li>
            <li>Click <strong>Success</strong> to approve (tickets issued immediately).</li>
            <li>Click <strong>Failure</strong> to simulate decline (retry enabled).</li>
          </ol>
          <div class="warning-box">
            <strong>No Bank Logins:</strong> Never enter real Netbanking credentials. Simulation runs entirely via interactive mock buttons.
          </div>
        </div>
        <div class="panel">
          <h3>📱 UPI Simulation (VPA)</h3>
          <ul>
            <li><span class="code">success@razorpay</span>: Simulates approved UPI payment. Confirms order and generates QR tickets.</li>
            <li><span class="code">failure@razorpay</span>: Simulates declined UPI request. Displays error; seats remain held.</li>
          </ul>
          <h3 style="margin-top: 6px;">🧪 Local Simulator Mode</h3>
          <p>When <code>ALLOW_MOCK_PAYMENTS=true</code> without Razorpay keys, EventDeck displays a dialog with <strong>Simulate Success</strong> and <strong>Simulate Decline</strong> exercising identical backend confirmation logic.</p>
        </div>
      </div>
    </div>

    <div class="footer-note">
      EventDeck University Event Management System · Technical Testing Documentation · Page 2 of 2
    </div>
  </div>

</body>
</html>
`;

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: "networkidle" });
  
  const outputDir = path.resolve(__dirname, "../docs/testing");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const outputPath = path.join(outputDir, "EVENTDECK_TEST_CREDENTIALS_AND_PAYMENTS.pdf");
  
  await page.pdf({
    path: outputPath,
    format: "A4",
    printBackground: true,
    margin: {
      top: "10mm",
      bottom: "10mm",
      left: "12mm",
      right: "12mm",
    },
  });
  
  await browser.close();
  console.log(`✓ PDF successfully regenerated at: ${outputPath}`);
}

main().catch((err) => {
  console.error("PDF generation failed:", err);
  process.exit(1);
});
