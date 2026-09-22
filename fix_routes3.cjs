const fs = require('fs');

let apps = fs.readFileSync('src/routes/applications.tsx', 'utf8');
apps = apps.replace(
  "const { data: applications, isLoading, error } = useQuery({\n    queryKey: ['applications'],\n    queryFn: () => api.listApplications(),\n  });",
  "const { data: applicationsResponse, isLoading, error } = useQuery({\n    queryKey: ['applications'],\n    queryFn: () => api.listApplications(),\n  });\n  const applications = applicationsResponse?.items;"
);
fs.writeFileSync('src/routes/applications.tsx', apps, 'utf8');

let appId = fs.readFileSync('src/routes/applications.$id.tsx', 'utf8');
appId = appId.replace(
  "const { data: applications } = useQuery({\n    queryKey: ['applications'],\n    queryFn: () => api.listApplications(),\n    staleTime: 30_000,\n  });\n\n  const application = applications?.find((a) => a.id === id);",
  "const { data: applicationsResponse } = useQuery({\n    queryKey: ['applications'],\n    queryFn: () => api.listApplications(),\n    staleTime: 30_000,\n  });\n\n  const applications = applicationsResponse?.items;\n  const application = applications?.find((a) => a.id === id);"
);
fs.writeFileSync('src/routes/applications.$id.tsx', appId, 'utf8');

