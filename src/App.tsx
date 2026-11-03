import { useRoute } from './shared/router';
import Hub from './Hub';
import SlideApp from './games/slide/SlideApp';
import DropApp from './games/drop/DropApp';
import LettersApp from './games/letters/LettersApp';

export default function App() {
  const [game, ...params] = useRoute();
  return (
    <div className="app">
      {game === 'slide' ? (
        <SlideApp params={params} />
      ) : game === 'drop' ? (
        <DropApp params={params} />
      ) : game === 'letters' ? (
        <LettersApp params={params} />
      ) : (
        <Hub />
      )}
    </div>
  );
}
