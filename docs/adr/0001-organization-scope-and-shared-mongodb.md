# Organization scope and shared MongoDB

The active Better Auth Organization ID is the canonical `businessId` used by the dashboard, n8n workflows, and Messaging Service. All operational records plus Zaileys authentication and message history use the shared MongoDB deployment; custom Zaileys adapters are justified because built-in adapters do not support MongoDB and splitting credentials into a filesystem or second database would weaken backup and tenant-isolation guarantees.
