# LankaPOS — User Guide

*(සිංහල පරිවර්තනය: [`USER_GUIDE.si.md`](USER_GUIDE.si.md))*

This guide is for the people who run the shop day to day: cashiers,
managers, and the admin. It explains what each screen does and how to get
common tasks done. If you're looking for how the software is built instead,
see `docs/PROJECT_OVERVIEW.md`.

The app works in English and Sinhala — switch anytime from the language
toggle (**EN** / **SI**) in the top-right corner of the screen, or from
**Settings**. Everything you type yourself (item names, customer names,
notes) is kept exactly as you typed it and is never translated.

## 1. Signing in

- **First time on a fresh install**: username `admin`, password `admin123`.
  **Change this password immediately** — go to your account menu (top
  right) and set a real password. Anyone who knows the default can get
  into every part of the system otherwise.
- If you step away, the app locks itself automatically after a period of
  inactivity (the admin can adjust how long, under session settings).
  Unlock by re-entering your password — you don't need to log in from
  scratch.
- **Logout** is the button in the top-right corner, next to your name.

### What each role can see

| Role | Can access |
|---|---|
| **Cashier** | Sales, Quotations, Returns, Customers, Settings |
| **Manager** | Everything a cashier can, plus Inventory, Suppliers, Pricing, Reports |
| **Admin** | Everything — plus Users, Backup & Recovery, Audit Log |

Every tab you're allowed to see appears across the top of the screen (laid
out over two or three rows, depending on your role), each with its own
icon and color so you can tell at a glance which section you're in.

## 2. Point of Sale (Sales tab)

This is the main checkout screen, and where a cashier will spend most of
their time.

### Adding items to the cart

Click into the search box and either **scan a barcode** with a barcode
scanner, or type part of a title/author/ISBN and press Enter.

- If the scan/search matches **exactly one item**, a **quantity dialog**
  pops up immediately — it shows the item's name and price, with the
  quantity field already selected and ready to type over (just start
  typing a number, no need to click into the field first). Press **Enter**
  or click **Add to Cart** to add that quantity to the cart, or **Esc** /
  **Cancel** to back out without adding anything. Focus returns to the
  scanner field automatically so you can keep scanning without touching
  the mouse.
- If you scan the **same item again** while it's already in the cart, the
  quantity you enter is **added on top of** what's already there (so
  scanning the same item twice with quantity 1 each time gives you 2 in
  the cart, not two separate lines).
- If the search matches **more than one item**, a dropdown list appears —
  click the one you want, which opens the same quantity dialog.

### Editing the cart

Each cart line shows the item, a quantity box you can type into directly,
the unit price, and the line total. Click **Remove** to take a line out of
the cart entirely.

### Customer, hold, and checkout

- **Customer**: search by name or phone in the panel on the right to
  attach the sale to a customer (needed for credit-account payments or to
  earn that customer loyalty points). Leave it blank for a walk-in sale.
- **Hold Sale**: parks the current cart so you can serve another customer
  and come back to it later. **Resume Held Sale** brings up the list of
  parked sales.
- **Checkout**: opens the payment screen. You can split a single sale
  across multiple payment methods (cash, card, mobile wallet, credit,
  other) — enter an amount for each; the total of all rows must cover the
  sale total before **Complete Sale** is enabled. If the customer is
  paying by **credit**, they must already have a credit account with
  enough available credit.
- **Find Invoice**: search for and reprint a completed sale's receipt by
  invoice number, without needing to redo the sale.

### Receipts

After checkout (or from Find Invoice), the receipt screen shows exactly
what will print, including the shop's name/address/phone/email at the top
(set once under **Settings → Profile Data** — see §12). From here you can:

- **Choose a paper size**: **A4**, **A5**, or **80mm Thermal** — pick
  whichever matches what you're about to print or export. "Print Receipt"
  (to a physical thermal printer) is only offered when 80mm is selected,
  since that's the only size a receipt printer can actually print.
- **Export PDF**: saves the receipt as a PDF file at the chosen size —
  useful for emailing a customer a proper A4 invoice instead of a thermal
  slip.
- **Print Receipt**: sends the receipt straight to the configured thermal
  printer.
- **Start New Sale**: closes the receipt and clears the cart for the next
  customer.

### Register Closing (second tab on this page)

At the end of a shift, use this to reconcile the cash drawer: enter the
opening float and the cash you actually counted, and the system compares
it against what it expected based on the day's cash sales, showing any
variance. Closing the register creates a permanent record — past closings
are listed below the form.

## 3. Quotations

A quotation is a **price estimate for a customer that isn't a sale yet** —
no payment is taken and no stock is reserved or deducted when you create
one. It only becomes a real sale (and only then affects stock) when
someone explicitly converts it.

- **New Quotation** tab: build the item list exactly like the Sales cart
  (same scan-to-quantity-dialog flow), optionally attach a customer, set a
  **Valid until** date if the price is only good for a limited time, add
  any notes, then **Save Quotation**.
- **Quotations** tab: lists every quotation with its status, customer,
  total, and valid-until date.
  - **View / Print** opens the same receipt screen as a sale, but clearly
    labeled **"Quotation No"** (not "Invoice No") with a note that it's a
    price quotation, not a tax invoice, and the valid-until date if one
    was set. The same A4/A5/80mm choice applies.
  - **Void** cancels a quotation that's no longer needed — it can't be
    converted after that.
  - **Convert to Sale** is how a quotation becomes a real transaction:
    it asks for payment just like a normal checkout, and only at that
    point does stock actually get deducted and a real invoice number get
    issued. A quotation can only be converted (or voided) once — trying
    it again shows a clear error instead of silently doing nothing.

## 4. Returns

Use this when a customer brings something back.

- **Process Return** tab: look up the original sale, select which items
  and quantities are being returned, and a reason if useful. Small refunds
  (under the shop's configured approval threshold) complete immediately
  and put stock back automatically. Larger refunds go to **Pending
  Approvals** first.
- **Pending Approvals** tab (manager/admin only): approve or reject
  returns that are waiting on a decision. Approving finalizes the refund
  and puts the stock back; rejecting leaves the sale as-is.

## 5. Inventory (manager/admin)

### Items tab

This is the shop's catalog. Each item has a title, author/publisher (if
relevant), an optional **Brand**, ISBN and/or barcode, category, language,
tax rate, cost price, selling price, stock quantity, reorder level, and
shelf location.

- **Add Item** / **Edit** opens the item form. Only the title is required
  — everything else is optional, including Brand (not everything a school
  shop sells has one).
- **Barcode and ISBN must be unique** — if you try to save an item with a
  barcode or ISBN that's already used by another item, you'll get a clear
  message telling you so, instead of a confusing generic error.
- **Adjust stock** lets you manually correct a quantity (e.g. for damaged
  stock) or record a write-off, with a note explaining why.
- **Deactivate** removes an item from the active catalog without deleting
  its history — it can be reactivated later. Items below their reorder
  level are flagged with a **Low stock** badge in the list.

### Stock Take tab

Use this to do a full physical count. **Start stock take** (optionally
scoped to one category) creates a session; enter the counted quantity for
each item as you go. **Complete stock take** corrects every item's stock
to match what was actually counted — it can't be undone, so make sure the
count is right first.

## 6. Customers

- **Customers** tab: add/edit customer records (name, phone, email,
  address). Turning on **credit account** lets that customer pay on
  credit up to a limit you set, tracked automatically as sales/returns/
  payments happen. Loyalty points accrue automatically on purchases (the
  rate is configurable) and can be adjusted manually if needed.
- **Preorders** tab: track a customer's request for an out-of-stock item.
  There's no automated notification — "Notified" is a manual flag you set
  after calling the customer yourself.

## 7. Suppliers

- **Suppliers** tab: your supplier contact records and running balance
  owed.
- **Purchase Orders**: create an order to a supplier for specific items
  and quantities.
- **Goods Received**: record what actually arrived against a purchase
  order (or without one, for an unplanned delivery) — this is what
  actually adds stock in, not the purchase order itself.
- **Payments**: record payments made to a supplier against their balance.

## 8. Pricing (manager/admin)

- **Tax Rates**: configurable tax rates; one is flagged as the shop's
  default for new items.
- **Discounts**: percentage or fixed-amount discounts, scoped to a
  specific item, a whole category, or the entire store. When more than one
  could apply, the most specific one wins (item beats category beats
  store-wide).
- **Combo Offers**: buy-N-get-M-free style promotions, scoped to an item
  or category.

## 9. Reports (manager/admin)

- **Summary**: sales totals bucketed by day/week/month.
- **Best Sellers**: top- and slow-moving items.
- **Profit & Loss**: revenue vs. cost over a date range.
- **Sales By**: grouped by category, author, supplier, or cashier. Note:
  supplier attribution on a sale is a best-effort heuristic (the most
  recent goods-received note for that item), not a guaranteed per-sale
  record — the reports say so where it applies.

Every report can be exported as PDF or Excel.

## 10. Users (admin only)

Add, edit, deactivate, or reset the password of any user account, and
assign their role (cashier, manager, admin). You can't deactivate your own
account. Each user's language preference is remembered and applied
automatically the next time they sign in.

## 11. Backup & Recovery (admin only)

- Configure where backups are saved, whether automatic scheduled backups
  are on, how often, and how many old backups to keep.
- **Back up now** creates an immediate backup on demand.
- **Restore** replaces the live database with a chosen backup file and
  relaunches the app — do this only when you're sure, and ideally after
  taking a fresh backup of the current state first.

Back up regularly. This is the only safety net if something goes wrong —
there's no cloud copy, and Standalone mode works fully offline.

**If this till is in Networked mode** (§14), this screen looks and behaves
identically, but backup/restore work by connecting to the shared server
instead of copying a local file — you'll see a note about this on the page
itself. The one thing this changes for you: the PostgreSQL client tools
need to be installed on **this PC** (the one clicking Backup Now/Restore),
not the server — see §14.5. If Backup Now fails with a message about a
tool not being found, that's what it means.

## 12. Settings

Reachable by everyone, though only admin/manager can change most of it.

- **Profile Data**: the shop's business name, phone number(s), email, and
  address. This is what prints at the top of every receipt and quotation
  — set it up once when the shop starts using the system. Cashiers can see
  it but not change it.
- **Language**: switch the app between English and Sinhala. This is
  separate from the receipt-language setting (which an admin controls
  elsewhere) — a shop can run the app in English while always printing
  Sinhala receipts, or vice versa.
- **Server Connection** (admin only): switch this till between Standalone
  and Networked mode, and enter/test the shared server's connection
  details. See §14 for the full setup walkthrough — this is where you
  point each till at the server once it's ready.
- **Import Existing Data** (admin only, Networked mode only): the one-time
  tool for bringing an existing Standalone shop's data onto a freshly set
  up server. See §14.6.
- A software copyright notice is shown alongside these, visible to every
  role. It's informational only — nothing to configure there.

## 13. Audit Log (admin only)

A searchable, filterable record of every create/update made anywhere in
the system, who did it, and when. Use it to answer "who changed this and
when" questions — it's append-only and can't be edited or cleared.

## 14. Networked Setup (Multi-Till)

If your shop has more than one till (checkout PC) and you want them all to
share the same inventory, sales, and customer data in real time, this
section walks through setting that up. If you only have one till, you can
skip this entirely — Standalone mode (the default) works exactly as
described everywhere above, with no server and no network required.

### 14.1 What this is, in plain terms

Right now (Standalone mode), everything lives in a file on one PC. In
Networked mode, that data instead lives on one dedicated server PC, and
every till (including that same PC, if you want) connects to it over your
shop's own network. Every till then sees the same stock levels, the same
customer accounts, the same sales — a sale rung up on one till instantly
affects what another till sees.

This is still just for **one shop on one network** — it doesn't connect
separate shop locations together, and it needs all the tills and the
server to be reachable on the same local network (Wi-Fi or wired), not
over the internet.

### 14.2 Set up the server PC

Pick one PC to be the dedicated server. It should:

- Stay switched on and connected to the network whenever any till needs to
  work (if it's off, every till shows a "can't reach the server" screen —
  see §14.4).
- Not need to be a till itself, though it's allowed to be — a small shop
  might just designate its back-office PC.

On that PC:

1. **Install PostgreSQL.** Download the installer from
   [postgresql.org](https://www.postgresql.org/download/windows/) and run
   it. During setup, you'll be asked to set a password for the `postgres`
   user — **write this down**, you'll need it in step 14.3. Keep the
   default port, **5432**.
2. **Open the firewall for port 5432**, so the other tills can reach it:
   - Open **Windows Defender Firewall with Advanced Security** (search for
     it in the Start menu).
   - Click **Inbound Rules** → **New Rule...**
   - Choose **Port** → **TCP** → enter **5432** → **Allow the connection**
     → apply it to all profiles → give it a name like "LankaPOS Postgres".
3. **Find this PC's IP address** — open a Command Prompt and run
   `ipconfig`, then note the **IPv4 Address** (something like
   `192.168.1.10`). You'll enter this on every till in the next step.

### 14.3 Point each till at the server

On every till PC (including the server PC itself, if it's also used as a
till):

1. Sign in as an admin and go to **Settings → Server Connection**.
2. Switch the mode from **Standalone** to **Networked**.
3. Fill in:
   - **Server address**: the IP address from step 14.2 (e.g. `192.168.1.10`)
   - **Port**: `5432` (leave as default unless you changed it)
   - **Database name**: any name you'd like LankaPOS to use on the server —
     use the same name on every till
   - **Username**: `postgres`
   - **Password**: the password you set in step 14.2
4. Click **Test Connection** — it should report success. If it doesn't,
   double check the IP address, that the server PC is switched on, and the
   firewall step above.
5. Click **Save**, then **Restart Now** when prompted. The till reconnects
   using the new settings.

The very first till to connect in Networked mode sets up the server's
database structure automatically — you don't need to do anything extra for
that.

### 14.4 What a till shows if it can't reach the server

If a till starts up and can't reach the configured server at all (wrong
IP, server switched off, network cable unplugged, firewall blocking it),
it shows a clear "Can't reach the server" screen instead of a blank or
frozen window — with a **Retry** button, and a **Fix Connection Settings**
link to correct a typo right there without needing to know how to edit any
files by hand.

If the connection drops while a till is already running and in use (a
brief network hiccup, the server restarting), a banner appears at the top
of the screen saying the connection was lost and it's reconnecting. The
till simply can't complete an action (like a sale) while disconnected —
there's no working offline and syncing up later — but as soon as the
server is reachable again, the banner clears on its own and the till works
normally.

### 14.5 Backup & Recovery in Networked mode

Backup & Recovery (§11) looks and works the same from this screen, but
needs the **PostgreSQL client tools** installed on whichever PC actually
clicks "Backup Now" or "Restore" (not necessarily the server — any till
can do it, as long as that PC has the tools). Installing PostgreSQL there
too (step 14.2) is the simplest way to get them. If a backup fails with a
message about a missing tool, that's what it's asking for.

### 14.6 Moving an existing shop's data onto the new server

If you're switching a shop that's already been using LankaPOS in
Standalone mode (with real items, customers, sales history) over to
Networked mode, you don't have to start over. After completing 14.2 and
14.3 on the till that has the existing data:

1. Go to **Settings → Import Existing Data** (only visible once that till
   is in Networked mode).
2. Click **Choose SQLite File** — it suggests the till's own existing
   database by default, or pick a backup `.db` file instead.
3. Click **Import Data**, confirm, and wait — it reports how many rows it
   imported per table when done, so you can sanity-check the numbers
   against what you had before.

This only works **once**, against a server with no real data on it yet —
running it a second time (or against a server that already has other
data) is refused, to avoid creating duplicates. Do this right after
setting up the server, before any till starts using it for real sales.

## Tips & things worth knowing

- **Sinhala thermal receipts print as an image**, not text — thermal
  printers don't have Sinhala characters built in, so a Sinhala receipt is
  rendered as a picture and printed that way instead. It looks slightly
  different from an English receipt on paper (image vs. crisp text) — that's
  expected, not a fault.
- **A4/A5 exports are full invoice-style pages**, not just a stretched
  thermal slip — use them when a customer wants something that looks like
  a proper printed invoice rather than a till receipt.
- **User-entered data is never translated.** Item titles, author names,
  customer names — whatever you type is what's stored and shown, in
  whichever language you typed it in, regardless of which UI language is
  active.
- **Nothing here calls or emails anyone automatically.** Preorder
  notifications and anything similar are manual steps you do yourself by
  phone — there's no automated messaging built in.
- **This is a single-shop tool** — it doesn't support multiple branches or
  locations syncing together. It *can* run as several tills in the same
  shop sharing one set of data over your own network (Networked mode) —
  see §14 if that's what you need; a single till (Standalone mode, the
  default) works exactly as described everywhere above either way.
