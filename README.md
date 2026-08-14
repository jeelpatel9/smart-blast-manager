# WhatsApp Campaign Hub

Build a new application called "WhatsApp Campaign Manager".

The application will eventually allow an administrator to:

1. Upload an Excel file containing customer names, phone numbers, and additional customer fields.

2. Store and manage those contacts.

3. Upload and manage campaign images.

4. Create WhatsApp campaigns.

5. Write and edit WhatsApp messages.

6. Use an AI Campaign Assistant to generate and modify messages.

7. Preview personalized messages using variables such as {{name}}, {{city}}, and {{product}}.

8. Select recipients from the contact database.

9. Eventually send messages and images through the Meta WhatsApp Cloud API.

10. Track sent, delivered, read, failed and pending messages.

IMPORTANT ARCHITECTURE:

- Use Lovable Cloud for the application's backend.

- Use Lovable Cloud database for persistent application data.

- Use Lovable Cloud Storage for Excel files and images.

- Use Lovable Cloud authentication for administrator login.

- Use server-side functions/edge functions for future WhatsApp API integration.

- Do NOT create a separate Node.js backend.

- Do NOT use n8n.

- Do NOT implement the Meta WhatsApp API yet.

- Do NOT ask me for Meta API credentials yet.

- Keep WhatsApp integration modular so it can be added later.

For the first version, create the complete application structure and database architecture.

Create these pages:

- Login

- Dashboard

- Contacts

- Import Contacts

- Media Library

- Campaigns

- Create Campaign

- Campaign Details

- Message History

- AI Assistant

- Settings

- Activity Logs

Create a professional modern SaaS-style admin dashboard with a sidebar navigation.

Create the required database structure for:

- contacts

- campaigns

- campaign_recipients

- messages

- media

- webhook_events

- activity_logs

The contacts table should support:

- name

- phone

- email

- city

- state

- company

- product

- custom fields

- status

- created_at

- updated_at

Campaigns should support:

- name

- message

- image

- recipient filters

- status

- created_at

- updated_at

- approved_at

- sent_at

Campaign status values:

DRAFT

READY

APPROVED

SENDING

COMPLETED

PARTIALLY_FAILED

FAILED

CANCELLED

Create authentication and make the dashboard accessible only to authenticated administrators.

Do not implement actual WhatsApp sending yet.

Do not implement the AI agent yet.

First create the clean foundation of the application so we can implement Excel import, AI, and Meta WhatsApp integration step by step.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2966cbb2-3f82-47b4-9ba9-120855cb610e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
