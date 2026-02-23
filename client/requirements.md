## Packages
date-fns | Required for complex date math and formatting in Gantt and Resource charts
recharts | Required for Resource utilization visualization

## Notes
- Expecting a standard Shadcn UI installation in `client/src/components/ui/`
- The project assumes `recharts` is used for charts.
- `date-fns` is used extensively for calculating Gantt chart bar widths and positions.
- The `schedule.generate` endpoint is assumed to recalculate `startDate` and `endDate` for tasks based on their duration and dependencies.
