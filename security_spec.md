# Security Specification

## Data Invariants
1. **Attendance/Payroll**: Employees can only read their own records. Admins can read all.
2. **Users**: Users can only read their own profile. Admins can read all.
3. **Announcements**: Employees can read all. Admins can create/update.
4. **Chats**: Participants can only read messages in chats they participate in.

## The "Dirty Dozen" Payloads (Examples)
1. Employee trying to read another employee's payslip.
2. Employee creating a chat message in a chat they aren't part of.
3. Anonymous user trying to write to `attendance`.
4. Admin writing to `employees` with a fake field `isSuperAdmin: true`.
5. Employee updating their own `role` to 'admin'.
6. Admin deleting a critical system log.
7. Employee reading `logs`.
8. Updating `createdAt` timestamp to be in the past/future.
9. Using an ID with malicious characters (e.g., `../../..`).
10. Creating a payroll entry without a valid `employeeId`.
11. Updating a read-only field like `originalOwnerId`.
12. Attempting a read on a chat participant list without being in that chat.
