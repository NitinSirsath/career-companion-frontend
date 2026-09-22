const fs = require('fs');

let index = fs.readFileSync('src/routes/index.tsx', 'utf8');

index = index.replace(
  "const { data: actions, isLoading } = useQuery({\n    queryKey: ['actions', { status: 'PENDING' }],\n    queryFn: () => api.getActions('PENDING'),\n  });",
  "const { data: actionsResponse, isLoading } = useQuery({\n    queryKey: ['actions', { status: 'PENDING' }],\n    queryFn: () => api.getActions('PENDING'),\n  });\n  const actions = actionsResponse?.items;"
);

index = index.replace(
  "const { data: ambiguousEmails, isLoading } = useQuery({ queryKey: ['ambiguous-emails'], queryFn: () => api.getAmbiguousEmails() });\n  const resolveMutation = useMutation",
  "const { data: ambiguousEmailsResponse, isLoading } = useQuery({ queryKey: ['ambiguous-emails'], queryFn: () => api.getAmbiguousEmails() });\n  const ambiguousEmails = ambiguousEmailsResponse?.items;\n  const resolveMutation = useMutation"
);
index = index.replace(
  "Needs Review ({ambiguousEmails.length})",
  "Needs Review ({ambiguousEmails.length}{ambiguousEmailsResponse?.metadata?.nextOffset ? '+' : ''})"
);


index = index.replace(
  "const { data: unmatchedEmails, isLoading } = useQuery({ queryKey: ['unmatched-emails'], queryFn: () => api.getUnmatchedEmails() });\n  const resolveMutation = useMutation",
  "const { data: unmatchedEmailsResponse, isLoading } = useQuery({ queryKey: ['unmatched-emails'], queryFn: () => api.getUnmatchedEmails() });\n  const unmatchedEmails = unmatchedEmailsResponse?.items;\n  const resolveMutation = useMutation"
);
index = index.replace(
  "Unmatched Emails ({unmatchedEmails.length})",
  "Unmatched Emails ({unmatchedEmails.length}{unmatchedEmailsResponse?.metadata?.nextOffset ? '+' : ''})"
);


index = index.replace(
  "const { data: applications } = useQuery({\n    queryKey: ['applications'],\n    queryFn: () => api.listApplications(),\n  });",
  "const { data: applicationsResponse } = useQuery({\n    queryKey: ['applications'],\n    queryFn: () => api.listApplications(),\n  });\n  const applications = applicationsResponse?.items;"
);

fs.writeFileSync('src/routes/index.tsx', index, 'utf8');

let gmail = fs.readFileSync('src/routes/gmail.tsx', 'utf8');
gmail = gmail.replace(/messagesData\.total/g, "messagesData?.items?.length");
gmail = gmail.replace(/messagesData\.messages/g, "messagesData.items");
fs.writeFileSync('src/routes/gmail.tsx', gmail, 'utf8');

