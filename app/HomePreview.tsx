import { Box, CssBaseline, ThemeProvider, Typography } from "@mui/material";
import { HomeView, type HomeData } from "./Overview";
import { Notifications } from "./AccountPages";
import { makeTheme } from "./theme";
import type { Notice, Resource } from "./types";

// Development only (see main.tsx): Home drawn from made-up data, so its layout
// can be checked without signing in. Open /Pdrive/?preview=home, add &head=1
// for the Head Teacher view and &dark=1 for the dark theme. Never built into
// the published site.
const me = "me";
let serial = 0;
const resource = (
  title: string,
  subject: string,
  grade: string,
  type: string,
  state: Resource["status"],
  owner = "other",
  creator = "R. Dela Cruz",
): Resource => ({
  id: String(++serial),
  owner,
  title,
  creator,
  subject,
  grade,
  term: "Term 2",
  category: ["METHODS", "MODELS", "UNITS", "UNITS"][serial % 4],
  bank_resource_type: type,
  status: state,
  state,
  revision: 1,
  version: 1,
  bank_draft: state === "draft",
  archived: false,
  created: "2026-11-02",
  updated: "2026-11-0" + ((serial % 8) + 1),
  filename: "resource." + ["pdf", "docx"][serial % 2],
});
const bank: Resource[] = [
  resource(
    "Energy flow in rice fields",
    "Science",
    "Grade 8",
    "Slide deck",
    "approved",
    me,
    "M. Santos",
  ),
  resource(
    "Pagsulat ng talata tungkol sa bukid",
    "Filipino",
    "Grade 9",
    "Lesson plan",
    "approved",
  ),
  resource(
    "Fractions with palay harvest counts",
    "Mathematics",
    "Grade 7",
    "Activity sheet or worksheet",
    "approved",
    "o2",
    "J. Ramos",
  ),
  resource(
    "Mga bayani ng Nueva Ecija",
    "Araling Panlipunan",
    "Grade 7",
    "Reading material",
    "approved",
    "o3",
    "L. Bautista",
  ),
  resource(
    "Onion farming cost and profit",
    "Mathematics",
    "Grade 9",
    "Assessment",
    "approved",
    "o2",
    "J. Ramos",
  ),
  ...["Grade 7", "Grade 7", "Grade 8", "Grade 8", "Grade 8", "Grade 10"].map(
    (g, i) =>
      resource(
        "Science unit " + (i + 1),
        "Science",
        g,
        "Lesson plan",
        "approved",
        "o4",
        "P. Garcia",
      ),
  ),
  ...["Grade 7", "Grade 8", "Grade 9"].map((g, i) =>
    resource(
      "English unit " + (i + 1),
      "English",
      g,
      "Reading material",
      "approved",
      "o5",
      "A. Cruz",
    ),
  ),
  resource(
    "Backyard gulayan plan",
    "Technology and Livelihood Education",
    "Grade 8",
    "Lesson plan",
    "approved",
    "o6",
    "D. Mendoza",
  ),
];
const mine: Resource[] = [
  bank[0],
  resource(
    "Local weather patterns in Nueva Ecija",
    "Science",
    "Grade 7",
    "Slide deck",
    "returned",
    me,
    "M. Santos",
  ),
  resource(
    "Soil types near the school",
    "Science",
    "Grade 8",
    "Activity sheet or worksheet",
    "pending",
    me,
    "M. Santos",
  ),
  resource(
    "Irrigation and water cycle",
    "Science",
    "Grade 9",
    "Lesson plan",
    "draft",
    me,
    "M. Santos",
  ),
];
const waiting: Resource[] = [
  resource(
    "Tula tungkol sa anihan",
    "Filipino",
    "Grade 8",
    "Lesson plan",
    "pending",
  ),
  resource(
    "Ratio in fertilizer mixing",
    "Mathematics",
    "Grade 8",
    "Activity sheet or worksheet",
    "resubmitted",
    "o2",
    "J. Ramos",
  ),
];

const now = new Date("2026-11-10T15:00:00");
const notice = (
  body: string,
  created: string,
  read = false,
  module?: string,
): Notice => ({ id: created + body, body, created, read, module });
const notices: Notice[] = [
  notice(
    "Your resource was approved: Energy flow in rice fields",
    "2026-11-10T14:20:00",
    false,
    "1",
  ),
  notice(
    "New feedback on Local weather patterns in Nueva Ecija",
    "2026-11-10T09:05:00",
    false,
    "2",
  ),
  notice(
    "Collaboration invitation: Tula tungkol sa anihan",
    "2026-11-09T16:40:00",
    false,
    "3",
  ),
  notice(
    "Resource submitted: Soil types near the school",
    "2026-11-06T10:15:00",
    true,
    "4",
  ),
  notice(
    "Head Teacher alert: Term 2 submissions close on Friday.",
    "2026-10-28T08:00:00",
    true,
  ),
];

export function HomePreview() {
  const params = new URLSearchParams(location.search),
    head = params.has("head");
  const data: HomeData = {
    user: {
      id: me,
      name: head ? "Antonio Reyes" : "Maria Santos",
      email: "example@example.test",
      role: head ? "head" : "teacher",
      subjects: head ? [] : ["Science"],
    },
    rows: head ? [...bank, ...mine.slice(1), ...waiting] : mine,
    shared: { items: bank, total: bank.length },
    invitations: head ? 0 : 1,
    pendingAccounts: head ? 2 : 0,
    coverage: null,
  };
  const noop = () => {};
  return (
    <ThemeProvider theme={makeTheme(params.has("dark") ? "slate" : "white")}>
      <CssBaseline />
      <Box sx={{ p: 3 }}>
        <Typography variant="caption" color="text.secondary" component="p">
          Preview with example data
        </Typography>
        {params.get("preview") === "notifications" && (
          <Box sx={{ mt: 2 }}>
            <Notifications
              state={{
                user: data.user,
                teachers: [],
                notes: [],
                notifications: notices,
                workflowReady: true,
              }}
              onChanged={async () => {}}
              onOpen={noop}
              onCollaboration={noop}
              now={now}
            />
          </Box>
        )}
        <Box
          sx={{
            mt: 2,
            display:
              params.get("preview") === "notifications" ? "none" : "block",
          }}
        >
          <HomeView
            data={data}
            hour={9}
            onOpen={noop}
            onSummary={noop}
            go={noop}
            onBrowse={noop}
          />
        </Box>
      </Box>
    </ThemeProvider>
  );
}
