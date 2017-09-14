import isString from 'lodash/isString';
import {Record, Set} from 'immutable';

import HTML_TEMPLATE from '../../templates/new.html';

const Sources = Record({
  html: HTML_TEMPLATE,
  css: '',
  javascript: '',
});

const Instructions = Record({
  isKnownToBreakSyntaxHighlighting: false,
  markdown: '',
});

export default class Project extends Record({
  projectKey: null,
  sources: new Sources(),
  enabledLibraries: new Set(),
  hiddenUIComponents: new Set(),
  updatedAt: null,
  instructions: new Instructions(),
}) {
  static fromJS({
    projectKey = null,
    sources = {},
    enabledLibraries = [],
    hiddenUIComponents = [],
    updatedAt = null,
    instructions = {},
  }) {
    return new Project({
      projectKey,
      sources: new Sources(sources),
      enabledLibraries: new Set(enabledLibraries),
      hiddenUIComponents: new Set(hiddenUIComponents),
      updatedAt,
      instructions: new Instructions(isString(instructions) ?
        {markdown: instructions} :
        instructions),
    });
  }
}
