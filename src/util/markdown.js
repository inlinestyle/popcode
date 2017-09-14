import memoize from 'lodash/memoize';
import remark from 'remark';
import remarkReact from 'remark-react';
import remarkLowlight from 'remark-react-lowlight';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import js from 'highlight.js/lib/languages/javascript';
import githubSchema from 'hast-util-sanitize/lib/github.json';

const remarkWithHighlighting = memoize(() => {
  const schema = Object.assign({}, githubSchema, {
    attributes: Object.assign({}, githubSchema.attributes, {
      code: [
        ...(githubSchema.attributes.code || []),
        'className',
      ],
    }),
  });

  return remark().use(remarkReact, {
    sanitize: schema,
    remarkReactComponents: {
      code: remarkLowlight({css, js, xml}),
    },
  });
});

const remarkWithoutHighlighting = memoize(() =>
  remark().use(remarkReact),
);

export function toReact(markdown, useHighlighting) {
  return useHighlighting ?
    remarkWithHighlighting().processSync(markdown).contents :
    remarkWithoutHighlighting().processSync(markdown).contents;
}
