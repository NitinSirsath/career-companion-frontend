const fs = require('fs');

let appContent = fs.readFileSync('src/contracts/application.ts', 'utf8');
if (!appContent.includes('createPaginatedResponseSchema')) {
  appContent = `import { createPaginatedResponseSchema } from './pagination';\n` + appContent;
}
appContent = appContent.replace(
  "export const ListApplicationsResponseSchema = z.array(ApplicationResponseSchema);\nexport type ListApplicationsResponse = z.infer<typeof ListApplicationsResponseSchema>;",
  "export const ListApplicationsResponseSchema = createPaginatedResponseSchema(ApplicationResponseSchema);\nexport type ListApplicationsResponse = z.infer<typeof ListApplicationsResponseSchema>;"
);
fs.writeFileSync('src/contracts/application.ts', appContent, 'utf8');

let gmailContent = fs.readFileSync('src/contracts/gmail.ts', 'utf8');
if (!gmailContent.includes('createPaginatedResponseSchema')) {
  gmailContent = `import { createPaginatedResponseSchema } from './pagination';\n` + gmailContent;
}
gmailContent = gmailContent.replace(
  "export const MessagesListResponseSchema = z.object({\n  messages: z.array(EmailMessageSchema),\n  total: z.number(),\n});",
  "export const MessagesListResponseSchema = createPaginatedResponseSchema(EmailMessageSchema);"
);
fs.writeFileSync('src/contracts/gmail.ts', gmailContent, 'utf8');
