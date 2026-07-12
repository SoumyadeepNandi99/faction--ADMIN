/**
 * Plain-language explanations for every Founder Analytics card: what the metric
 * is, and why it is useful. Surfaced through the info button on each card so a
 * non-technical viewer (or an investor) can read the dashboard unaided.
 *
 * Style: short, concrete, no jargon where avoidable. No em dashes.
 */
export const EXPLAIN = {
    // Time spent
    totalTimeSpent:
        "Total hours students spent actively solving questions, added up across every student and every device they used. It is measured on the server from the time recorded against each question attempt, so a student who studies on a phone and a tablet still shows one combined number. Note this is time on task while solving, not total time the app was open: idle time, browsing chapters and watching videos are not counted, because the app does not record them.",
    timeActiveStudents:
        "How many students contributed any solving time in the selected range. This is the denominator for the averages beside it, so you can tell whether a high average comes from many students or just a few.",
    avgTimePerStudent:
        "The average solving time per active student in the range, with the median shown alongside. The median is usually the more honest figure: a handful of very heavy users pull the average up, so when the two are far apart most students are studying less than the average suggests.",
    avgTimePerActiveDay:
        "On a day a student actually studies, this is how long they study for. It separates depth from frequency: a student can have a long streak of short days, and this number is what tells you which one you are looking at.",
    testTimeShare:
        "How much of the solving time happened inside custom tests, shown as a share of the total. It is a slice of the total above and is never added on top of it, because questions answered during a test are already counted once in the overall time.",

    // North Star & Engagement
    dau: "The number of distinct students who solved at least one question today (in IST). This is the core pulse of the product: it shows how many people actually showed up and practised, not just opened the app.",
    wau: "Distinct students who solved at least one question in the last 7 days. A steadier signal than the daily number, useful for spotting week-over-week trends without daily noise.",
    mau: "Distinct students who solved at least one question in the last 30 days. The broadest measure of the active base, and the denominator for stickiness.",
    stickiness: "Daily active solvers divided by monthly active solvers, as a percent. It answers 'of the people who use us in a month, how many use us on any given day?'. Above roughly 20 percent is considered a healthy, habit-forming product.",
    qpau: "The average number of questions an active student solves on the days they are active. It measures depth of engagement: are active users doing a little or a lot each session.",
    totalStudents: "The total number of registered students that match the current filters. The size of the base the other percentages are measured against.",
    newSignups: "New student registrations in the selected date range. The top of the growth funnel and the raw input to the growth rate.",
    growth: "New signups this period versus the period just before it, as a percent change. A quick read on whether acquisition is speeding up or slowing down.",
    dauChart: "Daily active solvers plotted over time. The shape shows whether daily engagement is trending up, flat, or down.",
    signupsChart: "New student registrations per day. Spikes usually line up with launches, campaigns, or word of mouth.",

    // Activation & Retention
    activation48h: "The share of new students who solve at least one question within 48 hours of signing up. High activation means new users quickly reach their first 'aha' moment, which strongly predicts whether they stay.",
    activatedUsers: "The raw count of new students who solved a question within 48 hours of signup, out of all signups in range.",
    timeToFirstSolve: "The typical (median) time between a student signing up and solving their first question. Shorter is better: it means onboarding gets people to value fast.",
    signupsCohort: "The number of new students in the selected range, used as the cohort size for the activation and retention figures.",
    retentionCohorts: "For each week's group of new students, the share who came back and solved again on day 1, day 7, and day 30. Retention is the single best measure of whether the product delivers lasting value. 'Pending' means not enough time has passed yet to judge that milestone.",

    // Habit & Streaks
    onStreak: "The share of students who currently have an active daily streak (they solved recently enough to keep it alive). A direct measure of the daily habit the product is designed to build.",
    avgStreak: "The average length, in days, of students' current streaks. Rising over time means the habit is deepening across the base.",
    bestStreak: "The longest study streak any student has ever reached. A proof point for how sticky the habit can get for the most engaged users.",
    streak7_30: "How many students currently hold a streak of at least 7 days, and at least 30 days. These are the most committed, habit-formed users and often the best advocates.",
    streakDist: "How students are spread across streak-length bands. A distribution weighted toward longer streaks shows a healthier habit loop.",

    // Feature Usage
    potdParticipation: "Of the students active today, the share who attempted today's Problem of the Day. POTD is the daily hook, so this shows how well that hook is working.",
    potdSolveRate: "Of the students who attempted today's Problem of the Day, the share who got it correct. A read on whether the daily problem is pitched at the right difficulty.",
    usersGeneratingTests: "The share of students who have created at least one custom practice test. Shows adoption of self-directed practice, a sign of deeper investment in the product.",
    contestMissed: "Of students who were enrolled in contests, the share who did not take part. A high missed rate flags contests that are poorly timed or not compelling.",
    customTestFunnel: "Custom tests broken down by status: not started, active, and finished. The drop from created to finished shows where students lose momentum.",
    featureReach: "Of weekly active students, the share who touched each feature (POTD, custom tests, contests, doubt forum) in the last 7 days. Shows which features actually get used versus which are ignored.",
    contests: "Contest participation and accuracy at a glance: how many contests ran, how many entries, how many were missed, and the average score of those who took part.",
    doubtForum: "Activity in the community doubt forum: posts asked, comments, how many were marked solved, and how many distinct students posted. A measure of peer-to-peer engagement.",

    // Learning Outcomes
    totalSolvedHero: "Every correct answer submitted by students, counted across the whole platform. If 100 students each solve the same question, that counts as 100. This is the headline measure of learning activity happening on the product.",
    pyqSolved: "Correct answers on previous-year exam questions (real questions from past JEE and NEET papers). A high share signals that students trust the platform for serious, exam-relevant practice.",
    nonPyqSolved: "Correct answers on the platform's own practice and concept questions, as opposed to past-paper questions.",
    overallAccuracy: "The average of each student's accuracy rate (correct answers divided by attempts). A broad read on how well students are performing.",
    totalAttempts: "Every answer submitted, whether right or wrong. Compared with total solved, it shows both activity volume and the overall solve rate.",
    solvedTrend: "Questions solved over time. Cumulative shows the growth curve (the running total climbing); Daily shows how many were solved each day. The clearest picture of whether learning activity is increasing.",
    pyqVsOther: "The split of correct answers between real past-exam questions and the platform's own questions.",
    difficultyMix: "The split of solved questions across easy, medium, and hard. Shows whether students are being stretched or staying in their comfort zone.",
    solvedBySubject: "The share of all solved questions in each subject (Physics, Chemistry, Maths, Biology). Shows where student effort is concentrated and which subjects may need more content or nudging.",
    solvedByExam: "Solved questions tagged for each exam (NEET, JEE Mains, JEE Advanced). A question can be tagged for more than one exam, so these can overlap and add up to more than the total.",
    weakTopicUsers: "The number of students who have at least one topic flagged as weak based on their mistakes. Shows how many students the product can help with targeted revision.",
    avgWeakness: "The average weakness score across flagged topics. Higher means weaker. Useful for gauging how much remediation the base needs.",

    // Monetization & Notifications
    premiumShare: "The share of students on a paid (premium) plan versus free. The core conversion metric for revenue.",
    notifReadRate: "The share of notifications that students have opened or read. Measures how much attention the notification channel actually earns.",
    pushReach: "The share of students who can receive push notifications (they have a valid push token on a device). This is the ceiling on how many people a broadcast can physically reach.",
    totalNotifications: "The total number of notifications sent to students in the selected range.",
    freeVsPremium: "The split of the student base between free and premium plans.",
    notifEngagement: "How notifications are performing: the read rate (attention earned) and push reachability (how many devices can be reached at all).",
    appVsWeb: "How many students reach the platform through the mobile app versus the web browser, based on their login sessions. A student who uses both is counted in both, so the two numbers can add up to more than the total. Useful for deciding where to invest and for reading feature reach by platform.",
    likelyChurned: "A proxy for churn, NOT a confirmed uninstall count. The app cannot report its own removal, so we infer risk from sessions. 'Lost app reachability' is a student who once had a push token but no longer has an active push-enabled session (their device was reachable and now isn't; could also be a logout or expired token). 'Not seen in 14+ days' is a student with no active session and no recent activity. Treat these as early warning signals, not exact uninstalls.",
    mostActive: "Students ranked by solving time — the time actually spent solving questions (the sum of per-question time taken) over the selected window, defaulting to the last 10 days. This is measured time-on-task while solving, not full app screentime, which the platform does not track. Each attempt's time is capped at 10 minutes to remove outliers from tabs left open.",
} as const;
