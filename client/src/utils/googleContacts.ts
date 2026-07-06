export interface ContactSuggestion {
  name: string;
  email: string;
}

export const getGoogleAccessToken = async (): Promise<string> => {
  const jwtToken = localStorage.getItem('token');
  if (!jwtToken) return '';

  try {
    const res = await fetch('http://localhost:8000/api/auth/token', {
      headers: {
        Authorization: `Bearer ${jwtToken}`,
      },
    });

    if (!res.ok) return '';

    const data = await res.json();
    return data.accessToken || '';
  } catch (err) {
    console.error('[GET_GOOGLE_TOKEN_ERROR]', err);
    return '';
  }
};

export const searchGoogleContacts = async (
  query: string,
  accessToken: string
): Promise<{ suggestions: ContactSuggestion[]; status?: number }> => {
  if (!accessToken || !query || query.length < 2) return { suggestions: [] };

  try {
    const res = await fetch(
      `https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses&pageSize=50`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (res.status === 403) {
      return { suggestions: [], status: 403 };
    }

    if (!res.ok) return { suggestions: [] };

    const data = await res.json();
    const connections = data.connections || [];

    const suggestions = connections
      .map((person: any) => ({
        name: person.names?.[0]?.displayName || '',
        email: person.emailAddresses?.[0]?.value || ''
      }))
      .filter((c: ContactSuggestion) =>
        c.email &&
        (c.email.toLowerCase().includes(query.toLowerCase()) ||
         c.name.toLowerCase().includes(query.toLowerCase()))
      )
      .slice(0, 6);

    return { suggestions };
  } catch (err) {
    console.error('[GOOGLE_CONTACTS_SEARCH_ERROR]', err);
    return { suggestions: [] };
  }
};
