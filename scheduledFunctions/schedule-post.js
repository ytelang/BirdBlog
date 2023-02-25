const CronJob = require("node-cron");

exports.initScheduledJobs = () => {
  const scheduledJobFunction = CronJob.schedule("* * * * *", () => {
    console.log("I'm executed on a schedule!");
    // Add your custom logic here
  });

  scheduledJobFunction.start();
}