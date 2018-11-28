export const BASIC_DATA_FETCHING = 
`  getData(): Observable<any> {
    return this.http.get('/api/users')
      .map(data => MOCK_DATA);
  }
`;

export const NEW_DECORATOR =
`{
  selector: 'app-foo-component'
}`;
