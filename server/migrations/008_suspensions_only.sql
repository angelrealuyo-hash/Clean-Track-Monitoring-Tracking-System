-- The admin's "Holiday" type was removed: Routes & Schedules only adds
-- suspensions now. Older holiday rows become suspensions (same effect: no
-- regular pickup on that date). The table and its CHECK stay as they are.
UPDATE schedule_exceptions SET kind = 'suspended' WHERE kind = 'holiday';
