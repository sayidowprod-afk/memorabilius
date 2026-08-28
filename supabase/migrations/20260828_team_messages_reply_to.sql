-- Support de "repondre a un message" (comme Discord) dans le chat de team.
ALTER TABLE team_messages ADD COLUMN IF NOT EXISTS reply_to_id integer REFERENCES team_messages(id) ON DELETE SET NULL;
