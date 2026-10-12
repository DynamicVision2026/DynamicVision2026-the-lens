import { loadBundle } from '@lens/scenes';

// WO-001 placeholder: list every card from the bundle. Styling comes in WO-002.
export function App() {
  const { cards } = loadBundle();

  return (
    <main>
      <h1>視点レンズ</h1>
      <table>
        <thead>
          <tr>
            <th>id</th>
            <th>lens</th>
            <th>answer</th>
          </tr>
        </thead>
        <tbody>
          {cards.map((card) => (
            <tr key={card.id}>
              <td>{card.id}</td>
              <td>{card.lens}</td>
              <td>{card.answer.display_ja ?? card.answer.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
