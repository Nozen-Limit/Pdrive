import { Box, Divider, Typography } from "@mui/material";
import { categories, categoryHelp, fileHint } from "./domain";

// The Standard Operating Procedure teachers follow in Learning Action Cell
// sessions: how to download, how to upload and label, and how Head Teachers
// review. Review steps are shown to Head Teachers only.
const steps = (items: string[]) => (
  <Box component="ol" sx={{ pl: 2.5, m: 0, "& li": { mb: 0.75 } }}>
    {items.map((item) => (
      <Typography component="li" key={item}>
        {item}
      </Typography>
    ))}
  </Box>
);

export function Help({ head }: { head: boolean }) {
  return (
    <Box sx={{ maxWidth: 680 }}>
      <Typography variant="h2" component="h2" gutterBottom>
        Find and download a resource
      </Typography>
      {steps([
        "Open Digital Bank. Every resource there is approved by a Head Teacher.",
        "Search, or filter by category, learning area, grade and term.",
        "Open a resource and choose Download. The file then opens without internet.",
        "Choose Save resource to keep it in your Saved tab.",
      ])}
      <Divider sx={{ my: 3 }} />
      <Typography variant="h2" component="h2" gutterBottom>
        Upload a resource
      </Typography>
      {steps([
        `Choose New resource, then your file (${fileHint}).`,
        "Basics: title, category, resource type, language, learning area, grade and term.",
        "Curriculum: the learning competency, how you localized it, tags and usage rights.",
        "Choose Submit for review. Save draft keeps it private until you are ready.",
        "If it is returned, open it from My Resources, read the feedback and upload a revised file.",
      ])}
      <Typography sx={{ mt: 2, mb: 1, fontWeight: 500 }}>
        Which category?
      </Typography>
      <Box component="dl" sx={{ m: 0 }}>
        {Object.entries(categories).map(([key, name]) => (
          <Box key={key} sx={{ mb: 1 }}>
            <Typography component="dt" sx={{ fontWeight: 500 }}>
              {name}
            </Typography>
            <Typography component="dd" color="text.secondary" sx={{ m: 0 }}>
              {categoryHelp[key]}
            </Typography>
          </Box>
        ))}
      </Box>
      <Typography sx={{ mt: 2 }}>
        Name the file after its lesson, for example “Grade 8 Science – Energy
        flow in rice fields”. Credit any source you adapted in Reference /
        Source.
      </Typography>
      <Divider sx={{ my: 3 }} />
      <Typography variant="h2" component="h2" gutterBottom>
        Work on a resource together
      </Typography>
      {steps([
        "Open Collaboration and invite a teacher to your draft.",
        "Discuss it there and propose revised files.",
        "The owner chooses the final file and submits it. Everyone who contributed is credited.",
      ])}
      {head && (
        <>
          <Divider sx={{ my: 3 }} />
          <Typography variant="h2" component="h2" gutterBottom>
            Review a submission (Head Teachers)
          </Typography>
          {steps([
            "Open Review Queue and choose a resource.",
            "Read the file, then mark each checklist item: objectives, content, activities, assessment.",
            "Approve it to publish it in the Digital Bank, or return it with feedback on what to revise.",
            "Use Edit details to correct its category, tags or term.",
            "Archive a resource to remove it from the bank without deleting its history.",
          ])}
        </>
      )}
    </Box>
  );
}
