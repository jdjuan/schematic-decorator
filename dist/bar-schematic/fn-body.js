"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BASIC_DATA_FETCHING = `  getData(): Observable<any> {
    return this.http.get('/api/users')
      .map(data => MOCK_DATA);
  }
`;
exports.NEW_DECORATOR = `{
  selector: 'app-foo-component'
}`;
