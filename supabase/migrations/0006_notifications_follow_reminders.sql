-- 0006_notifications_follow_reminders.sql
--
-- A notification outlives the thing it is about.
--
-- `notifications.reminder_id` was `on delete set null`, and `reminders`
-- cascades from `documents`. So deleting a document — something any owner or
-- manager may legitimately do — left its notifications behind with a null
-- reminder and an `href` pointing at a row that no longer exists.
--
-- The result is a dead link in somebody's list that cannot even be dismissed
-- properly: the acknowledge control only renders when there is a reminder to
-- acknowledge, so an orphaned notification is permanently stuck.
--
-- A notification exists to tell someone about a reminder. When the reminder is
-- gone, the notification has nothing to say, so it should go too.

-- Existing orphans. Every notification this application creates sets
-- reminder_id, so a null one is by definition left over from a delete.
delete from notifications where reminder_id is null;

alter table notifications
  drop constraint notifications_reminder_id_fkey;

alter table notifications
  add constraint notifications_reminder_id_fkey
  foreign key (reminder_id) references reminders (id) on delete cascade;

-- reminder_id is now required: there is no longer a state where a notification
-- exists without one, and allowing null would quietly reintroduce the orphan.
alter table notifications
  alter column reminder_id set not null;
