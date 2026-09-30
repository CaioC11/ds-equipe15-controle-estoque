import { AppProvider } from './app/provider';
import RouteMap from './routes';

function App() {
  return (
    <AppProvider>
      <RouteMap />
    </AppProvider>
  );
}

export default App;
