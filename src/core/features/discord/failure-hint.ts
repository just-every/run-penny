const hints:Record<string,string>={
 discord_source_check_in_progress:'Checking the Discord source. If interrupted, recovery will show a failure after five minutes.',
 interrupted_source_check_retry_required:'The source check was interrupted. The owner can review and save Discord capture settings to retry source checks.',
 restored_source_check_review_required:'The source check was held during restore. The owner can review and save Discord capture settings to retry source checks.',
 discord_purge_failed:'The excerpt could not be purged. Check the installation database and audit storage; the next schedule will retry.',
 discord_rate_limited:'Discord reached its rate limit. Wait for it to reset, then retry.',
 discord_access_revoked:'Discord refused access. Reconnect the bot and check View Channel and Read Message History permissions.',
 discord_source_removed:'The message was deleted or is no longer available.',
 discord_message_content_unavailable:'Discord returned no readable text. Check Message Content Intent and channel permissions.',
 discord_owner_unavailable:'The accountable owner is no longer active. A current owner must save the connector before retrying.',
 interrupted_read_retry_required:'The capture stopped before it finished. Review it, then retry deliberately.',
 configuration_changed:'The connector configuration changed. Review its scope before retrying.',
 scope_changed:'This channel is no longer selected. Review the connector scope.',
}
export function discordFailureHint(code:string){return hints[code]??'Discord capture could not finish. Check the application permissions and connection, then retry deliberately.'}
