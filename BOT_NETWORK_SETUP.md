# Haywhy Bot Network

Use one bot instance as the central API. All participating instances run this same repository/module.

## Required hosting environment variables
- NETWORK_API_KEY: long random secret, identical on every instance.
- NETWORK_API_URL: public base URL of the central instance, set on every instance (including central).
- NETWORK_BOT_ID: unique ID for each instance (for example main, backup-1).

Optional:
- NETWORK_HEARTBEAT_INTERVAL_MS (default 30000)
- NETWORK_OFFLINE_AFTER_MS (default 90000)

Keep the key in your hosting platform's secret/environment-variable settings. Never commit it.

## Developer-only commands
- .botnetwork — registered bots and heartbeat-based online/offline status.
- .allping — queues a ping task for every online bot; each client handles it on its next heartbeat.
- .system — local process, Node, OS, CPU and RAM information.

Dashboard: /network/dashboard on the central instance. Enter the shared key to view the fleet.
The central registry is in memory and is repopulated as bots heartbeat after a central restart.
