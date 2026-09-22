const fs = require('fs');

let index = fs.readFileSync('src/routes/index.tsx', 'utf8');
index = index.replace(/const { data: actions, isLoading } = useQuery/g, "const { data: actionsResponse, isLoading } = useQuery");
index = index.replace(/const overdueActions = actions\.filter/g, "const actions = actionsResponse?.items || [];\n  const overdueActions = actions.filter");
index = index.replace(/const { data: ambiguousEmails, isLoading } = useQuery/g, "const { data: ambiguousEmailsResponse, isLoading } = useQuery");
index = index.replace(/const resolveMutation = useMutation/g, "const ambiguousEmails = ambiguousEmailsResponse?.items || [];\n  const resolveMutation = useMutation");
index = index.replace(/const { data: unmatchedEmails, isLoading } = useQuery/g, "const { data: unmatchedEmailsResponse, isLoading } = useQuery");
index = index.replace(/const resolveMutation = useMutation/g, "const unmatchedEmails = unmatchedEmailsResponse?.items || [];\n  const resolveMutation = useMutation");
index = index.replace(/const { data: applications } = useQuery/g, "const { data: applicationsResponse } = useQuery");
index = index.replace(/return \(\n    <div className="space-y-10">/g, "const applications = applicationsResponse?.items;\n\n  return (\n    <div className=\"space-y-10\">");
fs.writeFileSync('src/routes/index.tsx', index, 'utf8');

let apps = fs.readFileSync('src/routes/applications.tsx', 'utf8');
apps = apps.replace(/const { data: applications, isLoading, error } = useQuery/g, "const { data: applicationsResponse, isLoading, error } = useQuery");
apps = apps.replace(/const createMutation = useMutation/g, "const applications = applicationsResponse?.items || [];\n  const createMutation = useMutation");
fs.writeFileSync('src/routes/applications.tsx', apps, 'utf8');

let appId = fs.readFileSync('src/routes/applications.$id.tsx', 'utf8');
appId = appId.replace(/const { data: applications } = useQuery/g, "const { data: applicationsResponse } = useQuery");
appId = appId.replace(/const application = applications\?\.find/g, "const applications = applicationsResponse?.items || [];\n  const application = applications?.find");
fs.writeFileSync('src/routes/applications.$id.tsx', appId, 'utf8');

let gmail = fs.readFileSync('src/routes/gmail.tsx', 'utf8');
gmail = gmail.replace(/const { data: messagesData, isLoading: isLoadingMessages, error: messagesError } = useQuery/g, "const { data: messagesData, isLoading: isLoadingMessages, error: messagesError } = useQuery");
gmail = gmail.replace(/messagesData\.total/g, "messagesData?.items?.length");
gmail = gmail.replace(/messagesData\.messages/g, "messagesData.items");
fs.writeFileSync('src/routes/gmail.tsx', gmail, 'utf8');

