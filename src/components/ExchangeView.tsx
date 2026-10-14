import type { Exchange } from "../reading";
import { Icon } from "./Icon";

export const ExchangeView = ({
  exchange,
  onParagraph,
  showQuestion = true,
}: {
  exchange: Exchange;
  onParagraph?: (index: number) => void;
  showQuestion?: boolean;
}) => (
  <div className="exchange">
    {showQuestion && <p className="exchange-question">{exchange.question}</p>}
    <div className="exchange-answer">
      <div className="answer-label flex items-center gap-2">
        <Icon name="spark" />
        <span>Sample AI response</span>
      </div>
      <p>{exchange.answer}</p>
      <div className="citations flex flex-wrap gap-2">
        {exchange.paragraphs.map((number) =>
          onParagraph ? (
            <button
              type="button"
              key={number}
              onClick={() => onParagraph(number - 1)}
              aria-label={`Go to paragraph ${number}`}
            >
              ¶{number}
            </button>
          ) : (
            <span key={number}>¶{number}</span>
          ),
        )}
      </div>
    </div>
  </div>
);
