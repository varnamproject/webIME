import "./utils";
import TributeEvents from "./TributeEvents";
import TributeMenuEvents from "./TributeMenuEvents";
import TributeRange from "./TributeRange";
import TributeSearch from "./TributeSearch";
import { TributeElement, TributeOptions } from "./types";

class WebIME<T extends {}> {
  constructor({
    values = null,
    loadingItemTemplate = null,
    iframe = null,
    selectClass = "highlight",
    containerClass = "tribute-container",
    itemClass = "",
    trigger = "@",
    autocompleteMode = true, // webIME change
    autocompleteSeparator = null,
    selectTemplate = null,
    menuItemTemplate = null,
    lookup = "key",
    fillAttr = "value",
    collection = null,
    menuContainer = null,
    noMatchTemplate = null,
    requireLeadingSpace = true,
    allowSpaces = false,
    replaceTextSuffix = "", // webIME change
    positionMenu = true,
    spaceSelectsMatch = true, // webIME change
    searchOpts = {},
    menuItemLimit = null,
    menuShowMinLength = 1, // webIME change
    menuPageLimit = 9,
    wordBreakChars = [".", ",", "?", "!", "(", ")"], // For handling key events
    wordStopChars = [".", " ", ",", "?", "!", "(", ")", "\n", "\r", "\t"], // For filtering word from a sentence
  }: TributeOptions<T>) {
    this.autocompleteMode = autocompleteMode;
    this.autocompleteSeparator = autocompleteSeparator;
    this.menuSelected = 0;
    this.current = {};
    this.inputEvent = false;
    this.isActive = false;
    this.menuContainer = menuContainer;
    this.allowSpaces = allowSpaces;
    this.replaceTextSuffix = replaceTextSuffix;
    this.positionMenu = positionMenu;
    this.hasTrailingSpace = false;
    this.spaceSelectsMatch = spaceSelectsMatch;
    this.pages = [];
    this.currentPage = 0;
    this.wordBreakChars = wordBreakChars;
    this.wordStopChars = wordStopChars;

    if (this.autocompleteMode) {
      trigger = "";
      allowSpaces = false;
    }

    if (values) {
      this.collection = [
        {
          // symbol that starts the lookup
          trigger: trigger,

          // is it wrapped in an iframe
          iframe: iframe,

          // class applied to selected item
          selectClass: selectClass,

          // class applied to the Container
          containerClass: containerClass,

          // class applied to each item
          itemClass: itemClass,

          // function called on select that retuns the content to insert
          selectTemplate: (selectTemplate || WebIME.defaultSelectTemplate).bind(
            this
          ),

          // function called that returns content for an item
          menuItemTemplate: (
            menuItemTemplate || WebIME.defaultMenuItemTemplate
          ).bind(this),

          // function called when menu is empty, disables hiding of menu.
          noMatchTemplate: ((t) => {
            if (typeof t === "string") {
              if (t.trim() === "") return null;
              return t;
            }
            if (typeof t === "function") {
              return t.bind(this);
            }

            return (
              noMatchTemplate ||
              function () {
                return "<li>No Match Found!</li>";
              }.bind(this)
            );
          })(noMatchTemplate),

          // column to search against in the object
          lookup: lookup,

          // column that contains the content to insert by default
          fillAttr: fillAttr,

          // array of objects or a function returning an array of objects
          values: values,

          // useful for when values is an async function
          loadingItemTemplate: loadingItemTemplate,

          requireLeadingSpace: requireLeadingSpace,

          searchOpts: searchOpts,

          menuItemLimit: menuItemLimit,

          menuShowMinLength: menuShowMinLength,

          menuPageLimit: menuPageLimit,
        },
      ];
    } else if (collection) {
      if (this.autocompleteMode)
        console.warn(
          "Tribute in autocomplete mode does not work for collections"
        );
      this.collection = collection.map((item) => {
        return {
          trigger: item.trigger || trigger,
          iframe: item.iframe || iframe,
          selectClass: item.selectClass || selectClass,
          containerClass: item.containerClass || containerClass,
          itemClass: item.itemClass || itemClass,
          selectTemplate: (
            item.selectTemplate || WebIME.defaultSelectTemplate
          ).bind(this),
          menuItemTemplate: (
            item.menuItemTemplate || WebIME.defaultMenuItemTemplate
          ).bind(this),
          // function called when menu is empty, disables hiding of menu.
          noMatchTemplate: ((t) => {
            if (typeof t === "string") {
              if (t.trim() === "") return null;
              return t;
            }
            if (typeof t === "function") {
              return t.bind(this);
            }

            return (
              noMatchTemplate ||
              function () {
                return "<li>No Match Found!</li>";
              }.bind(this)
            );
          })(noMatchTemplate),
          lookup: item.lookup || lookup,
          fillAttr: item.fillAttr || fillAttr,
          values: item.values,
          loadingItemTemplate: item.loadingItemTemplate,
          requireLeadingSpace: item.requireLeadingSpace,
          searchOpts: item.searchOpts || searchOpts,
          menuItemLimit: item.menuItemLimit || menuItemLimit,
          menuShowMinLength: item.menuShowMinLength || menuShowMinLength,
          menuPageLimit: item.menuPageLimit || menuPageLimit,
          wordBreakChars: item.wordBreakChars || wordBreakChars,
          wordStopChars: item.wordStopChars || wordStopChars,
        };
      });
    } else {
      throw new Error("[Tribute] No collection specified.");
    }

    new TributeRange(this);
    new TributeEvents(this);
    new TributeMenuEvents(this);
    new TributeSearch(this);
  }

  _isActive: boolean;

  get isActive(): boolean {
    return this._isActive;
  }

  set isActive(val) {
    if (this._isActive != val) {
      this._isActive = val;
      if (this.current.element) {
        const noMatchEvent = new CustomEvent(`tribute-active-${val}`);
        this.current.element.dispatchEvent(noMatchEvent);
      }
    }
  }

  static defaultSelectTemplate(item) {
    if (typeof item === "undefined")
      return `${this.current.collection.trigger}${this.current.mentionText}`;
    if (this.range.isContentEditable(this.current.element)) {
      return (
        '<span class="tribute-mention">' +
        (this.current.collection.trigger +
          item.original[this.current.collection.fillAttr]) +
        "</span>"
      );
    }

    return (
      this.current.collection.trigger +
      item.original[this.current.collection.fillAttr]
    );
  }

  static defaultMenuItemTemplate(matchItem) {
    return matchItem.string;
  }

  static inputTypes() {
    return ["TEXTAREA", "INPUT"];
  }

  triggers() {
    return this.collection.map((config) => {
      return config.trigger;
    });
  }

  attach(el: TributeElement): void {
    if (!el) {
      throw new Error("[Tribute] Must pass in a DOM node or NodeList.");
    }

    // Check if it is a jQuery collection
    if (typeof jQuery !== "undefined" && el instanceof jQuery) {
      el = el.get();
    }

    // Is el an Array/Array-like object?
    if (
      el.constructor === NodeList ||
      el.constructor === HTMLCollection ||
      el.constructor === Array
    ) {
      const length = el.length;
      for (let i = 0; i < length; ++i) {
        this._attach(el[i]);
      }
    } else {
      this._attach(el);
    }
  }

  _attach(el) {
    if (el.hasAttribute("data-tribute")) {
      console.warn("Tribute was already bound to " + el.nodeName);
    }

    this.ensureEditable(el);
    this.events.bind(el);
    el.setAttribute("data-tribute", true);
  }

  ensureEditable(element) {
    if (WebIME.inputTypes().indexOf(element.nodeName) === -1) {
      if (!element.contentEditable) {
        throw new Error(
          "[Tribute] Cannot bind to " +
            element.nodeName +
            ", not contentEditable"
        );
      }
    }
  }

  createMenu(containerClass) {
    const wrapper = this.range.getDocument().createElement("div"),
      ul = this.range.getDocument().createElement("ul");
    wrapper.className = containerClass;
    wrapper.appendChild(ul);

    const pager = this.range.getDocument().createElement("div");
    pager.className = "pager";
    pager.innerHTML =
      "<span id='webime-previous'>&lt;</span><span id='webime-shift'>Shift +</span><span id='webime-next'>&gt;</span>";
    wrapper.appendChild(pager);

    if (this.menuContainer) {
      return this.menuContainer.appendChild(wrapper);
    }

    return this.range.getDocument().body.appendChild(wrapper);
  }

  showMenuFor(element, scrollTo) {
    // Only proceed if menu isn't already shown for the current element & mentionText
    if (
      this.isActive &&
      this.current.element === element &&
      this.current.mentionText === this.currentMentionTextSnapshot
    ) {
      return;
    }
    this.currentMentionTextSnapshot = this.current.mentionText;

    // create the menu if it doesn't exist.
    if (!this.menu) {
      this.menu = this.createMenu(this.current.collection.containerClass);
      element.tributeMenu = this.menu;
      this.menuEvents.bind(this.menu);
    }

    this.isActive = true;
    this.menuSelected = 0;
    this.pages = [];
    this.currentPage = 0; // Reset to first page

    if (!this.current.mentionText) {
      this.current.mentionText = "";
    }

    const processValues = (values) => {
      // Tribute may not be active any more by the time the value callback returns
      if (!this.isActive) {
        return;
      }

      let items = this.search.filter(this.current.mentionText, values, {
        pre: this.current.collection.searchOpts.pre || "<span>",
        post: this.current.collection.searchOpts.post || "</span>",
        skip: this.current.collection.searchOpts.skip,
        extract: (el) => {
          if (typeof this.current.collection.lookup === "string") {
            return el[this.current.collection.lookup];
          } else if (typeof this.current.collection.lookup === "function") {
            return this.current.collection.lookup(el, this.current.mentionText);
          } else {
            throw new Error(
              "Invalid lookup attribute, lookup must be string or function."
            );
          }
        },
      });

      if (this.current.collection.menuItemLimit) {
        items = items.slice(0, this.current.collection.menuItemLimit);
      }

      const pages = [];
      let page = [],
        pageItemIndex = 0;
      items.forEach((item, index) => {
        page.push(item);
        pageItemIndex++;

        if (pageItemIndex == this.current.collection.menuPageLimit) {
          pages.push(page);
          page = [];
          pageItemIndex = 0;
        } else if (index + 1 == items.length) {
          // Last item
          pages.push(page);
        }
      });
      this.pages = pages;
      this.currentPage = 0; // Reset to first page
      this.makePage();
    };

    if (typeof this.current.collection.values === "function") {
      if (this.current.collection.loadingItemTemplate) {
        this.menu.querySelector("ul").innerHTML =
          this.current.collection.loadingItemTemplate;
        this.range.positionMenuAtCaret(scrollTo);
      }

      this.current.collection.values(this.current.mentionText, processValues);
    } else {
      processValues(this.current.collection.values);
    }
  }

  makeList(items) {
    this.current.filteredItems = items;

    const ul = this.menu.querySelector("ul");

    this.range.positionMenuAtCaret(scrollTo);

    if (!items.length) {
      const noMatchEvent = new CustomEvent("tribute-no-match", {
        detail: this.menu,
      });
      this.current.element.dispatchEvent(noMatchEvent);
      if (
        (typeof this.current.collection.noMatchTemplate === "function" &&
          !this.current.collection.noMatchTemplate()) ||
        !this.current.collection.noMatchTemplate
      ) {
        this.hideMenu();
      } else {
        typeof this.current.collection.noMatchTemplate === "function"
          ? (ul.innerHTML = this.current.collection.noMatchTemplate())
          : (ul.innerHTML = this.current.collection.noMatchTemplate);
      }

      return;
    }

    ul.innerHTML = "";
    const fragment = this.range.getDocument().createDocumentFragment();

    for (let index = 0; index < items.length; index++) {
      const item = items[index];

      const li = this.range.getDocument().createElement("li");
      li.setAttribute("data-index", index);
      li.className = this.current.collection.itemClass;
      li.addEventListener("mousemove", (e) => {
        const [li, index] = this._findLiTarget(e.target);
        if (e.movementY !== 0) {
          this.events.setActiveLi(index);
        }
      });
      if (this.menuSelected === index) {
        li.classList.add(this.current.collection.selectClass);
      }
      li.innerHTML =
        `<div class="index">${index + 1}:</div><div class="suggestion">` +
        this.current.collection.menuItemTemplate(item) +
        `</div>`;
      fragment.appendChild(li);
    }
    ul.appendChild(fragment);
  }

  // Make current page
  makePage() {
    if (!this.pages[this.currentPage]) {
      return;
    }
    this.makeList(this.pages[this.currentPage]);

    const pager = this.menu.getElementsByClassName("pager")[0];
    const previousButton = pager.querySelector("#webime-previous");
    const nextButton = pager.querySelector("#webime-next");

    if (this.currentPage === 0) {
      previousButton.classList.add("hidden");
    } else {
      previousButton.classList.remove("hidden");
    }

    if (this.currentPage + 1 >= this.pages.length) {
      nextButton.classList.add("hidden");
    } else {
      nextButton.classList.remove("hidden");
    }

    if (this.currentPage === 0 && this.pages.length == 1) {
      pager.classList.add("hidden");
    } else {
      pager.classList.remove("hidden");
    }
  }

  previousPage() {
    if (this.currentPage - 1 >= 0) {
      this.currentPage--;
      this.makePage();
    }
  }

  nextPage() {
    if (this.pages.length > this.currentPage + 1) {
      this.currentPage++;
      this.makePage();
    }
  }

  _findLiTarget(el) {
    if (!el) return [];
    const index = el.getAttribute("data-index");
    return !index ? this._findLiTarget(el.parentNode) : [el, index];
  }

  showMenuForCollection(element: Element, collectionIndex?: number): void {
    if (element !== document.activeElement) {
      this.placeCaretAtEnd(element);
    }

    this.current.collection = this.collection[collectionIndex || 0];
    this.current.externalTrigger = true;
    this.current.element = element;

    if (element.isContentEditable)
      this.insertTextAtCursor(this.current.collection.trigger);
    else this.insertAtCaret(element, this.current.collection.trigger);

    this.showMenuFor(element);
  }

  // TODO: make sure this works for inputs/textareas
  placeCaretAtEnd(el) {
    el.focus();
    if (
      typeof window.getSelection != "undefined" &&
      typeof document.createRange != "undefined"
    ) {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } else if (typeof document.body.createTextRange != "undefined") {
      const textRange = document.body.createTextRange();
      textRange.moveToElementText(el);
      textRange.collapse(false);
      textRange.select();
    }
  }

  // for contenteditable
  insertTextAtCursor(text) {
    const sel = window.getSelection();
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const textNode = document.createTextNode(text);
    range.insertNode(textNode);
    range.selectNodeContents(textNode);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // for regular inputs
  insertAtCaret(textarea, text) {
    const scrollPos = textarea.scrollTop;
    let caretPos = textarea.selectionStart;

    const front = textarea.value.substring(0, caretPos);
    const back = textarea.value.substring(
      textarea.selectionEnd,
      textarea.value.length
    );
    textarea.value = front + text + back;
    caretPos = caretPos + text.length;
    textarea.selectionStart = caretPos;
    textarea.selectionEnd = caretPos;
    textarea.focus();
    textarea.scrollTop = scrollPos;
  }

  hideMenu() {
    if (this.menu) {
      this.menu.style.cssText = "display: none;";
      this.isActive = false;
      this.menuSelected = 0;
      this.pages = [];
      this.currentPage = 0;
      this.current = {};
    }
  }

  selectItemAtIndex(index, originalEvent) {
    index = parseInt(index);
    if (typeof index !== "number" || isNaN(index)) return;
    const item = this.current.filteredItems[index];
    let content = this.current.collection.selectTemplate(item);

    if (originalEvent.spaceSelection) {
      content += " "; // add a space
    } else if (originalEvent.wordBreak) {
      content += originalEvent.key; // add the break character
    }

    if (content !== null) this.replaceText(content, originalEvent, item);
  }

  replaceText(content, originalEvent, item) {
    this.range.replaceTriggerText(content, true, true, originalEvent, item);
  }

  _append(collection, newValues, replace) {
    if (typeof collection.values === "function") {
      throw new Error("Unable to append to values, as it is a function.");
    } else if (!replace) {
      collection.values = collection.values.concat(newValues);
    } else {
      collection.values = newValues;
    }
  }

  append(
    collectionIndex: number,
    newValues: Array<T>,
    replace?: boolean
  ): void {
    const index = parseInt(collectionIndex);
    if (typeof index !== "number")
      throw new Error("please provide an index for the collection to update.");

    const collection = this.collection[index];

    this._append(collection, newValues, replace);
  }

  appendCurrent(newValues: Array<T>, replace?: boolean): void {
    if (this.isActive) {
      this._append(this.current.collection, newValues, replace);
    } else {
      throw new Error(
        "No active state. Please use append instead and pass an index."
      );
    }
  }

  detach(el: TributeElement): void {
    if (!el) {
      throw new Error("[Tribute] Must pass in a DOM node or NodeList.");
    }

    // Check if it is a jQuery collection
    if (typeof jQuery !== "undefined" && el instanceof jQuery) {
      el = el.get();
    }

    // Is el an Array/Array-like object?
    if (
      el.constructor === NodeList ||
      el.constructor === HTMLCollection ||
      el.constructor === Array
    ) {
      const length = el.length;
      for (let i = 0; i < length; ++i) {
        this._detach(el[i]);
      }
    } else {
      this._detach(el);
    }
  }

  _detach(el) {
    this.events.unbind(el);
    if (el.tributeMenu) {
      this.menuEvents.unbind(el.tributeMenu);
    }

    setTimeout(() => {
      el.removeAttribute("data-tribute");
      this.isActive = false;
      if (el.tributeMenu) {
        el.tributeMenu.remove();
      }
    });
  }
}

export default WebIME;
