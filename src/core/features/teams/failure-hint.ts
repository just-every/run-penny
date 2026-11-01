const hints:Record<string,string>={
 teams_source_check_in_progress:'Checking the Teams source. If interrupted, recovery will show a failure after five minutes.',
 interrupted_source_check_retry_required:'The source check was interrupted. The owner can review and save Teams capture settings to retry source checks.',
 restored_source_check_review_required:'The source check was held during restore. The owner can review and save Teams capture settings to retry source checks.',
 teams_purge_failed:'The excerpt could not be purged. Check the installation database and audit storage; the next schedule will retry.',
 teams_rate_limited:'Teams reached its rate limit. Wait for it to reset, then retry.',
 teams_credentials_rejected:'Microsoft rejected the application credential. Check its expiry and tenant, then update the deployment secret and retry.',
 teams_access_revoked:'Teams refused access. Check the Entra application, admin consent and ChannelMessage.Read.All permission.',
 teams_source_removed:'The message was deleted or is no longer available.',
 teams_message_content_unavailable:'Teams returned no readable text. Check the selected message and Microsoft Graph channel permissions.',
 teams_owner_unavailable:'The accountable owner is no longer active. A current owner must save the connector before retrying.',
 interrupted_read_retry_required:'The capture stopped before it finished. Review it, then retry deliberately.',
 configuration_changed:'The connector configuration changed. Review its scope before retrying.',
 scope_changed:'This channel is no longer selected. Review the connector scope.',
}
export function teamsFailureHint(code:string){return hints[code]??'Teams capture could not finish. Check the application permissions and connection, then retry deliberately.'}
