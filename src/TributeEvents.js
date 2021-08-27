class TributeEvents {
  constructor(tribute) {
    this.tribute = tribute;
    this.tribute.events = this;
  }

  static keys() {
    return [
      {
        key: 9,
        value: "TAB"
      },
      {
        key: 8,
        value: "DELETE"
      },
      {
        key: 13,
        value: "ENTER"
      },
      {
        key: 27,
        value: "ESCAPE"
      },
      {
        key: 32,
        value: "SPACE"
      },
      {
        key: 38,
        value: "UP"
      },
      {
        key: 40,
        value: "DOWN"
      },
      {
        key: 37,
        value: "LEFT"
      },
      {
        key: 39,
        value: "RIGHT"
      }
    ];
  }

  isWordBreak(e) {
    return this.tribute.wordBreakChars.includes(e.key)
  }

  bind(element) {
    element.boundKeydown = this.keydown.bind(element, this);
    element.boundKeyup = this.keyup.bind(element, this);
    element.boundInput = this.input.bind(element, this);

    // WebIME: For showing suggestions on clicking a word
    element.boundClick = this.inputClick.bind(element, this);

    element.addEventListener("keydown", element.boundKeydown, true);
    element.addEventListener("keyup", element.boundKeyup, true);
    element.addEventListener("input", element.boundInput, true);
    element.addEventListener("click", element.boundClick, true);
  }

  unbind(element) {
    element.removeEventListener("keydown", element.boundKeydown, true);
    element.removeEventListener("keyup", element.boundKeyup, true);
    element.removeEventListener("input", element.boundInput, true);
    element.removeEventListener("click", element.boundClick, true);

    delete element.boundKeydown;
    delete element.boundKeyup;
    delete element.boundInput;
    delete element.boundClick;
  }

  keydown(instance, event) {
    if (instance.shouldDeactivate(event)) {
      instance.tribute.isActive = false;
      instance.tribute.hideMenu();
    }

    let element = this;
    instance.commandEvent = false;

    if (event.keyCode >= 49 && event.keyCode <= 57) {
      // numeric keys
      const suggestionIndex = event.keyCode - 49 // 49 is key 1

      instance.commandEvent = true;
      instance.callbacks()['numeric'](event, suggestionIndex);
    } if (event.keyCode >= 97 && event.keyCode <= 105) {
      // numpad keys
      const suggestionIndex = event.keyCode - 97  // 97 is key 1

      instance.commandEvent = true;
      instance.callbacks()['numeric'](event, suggestionIndex);
    } else if (instance.isWordBreak(event)) {
      instance.callbacks()['wordBreak'](event, element);
    } else {
      TributeEvents.keys().forEach(o => {
        if (o.key === event.keyCode) {
          instance.commandEvent = true;
          instance.callbacks()[o.value.toLowerCase()](event, element);
        }
      });
    }
  }

  input(instance, event) {
    instance.inputEvent = true;
    instance.keyup.call(this, instance, event);
  }

  click(instance, event) {
    let tribute = instance.tribute;
    if (tribute.menu && tribute.menu.contains(event.target)) {
      if (event.target.parentNode.className === "pager") {
        if (event.target.id === "webime-previous") {
          tribute.previousPage();
        } else if (event.target.id === "webime-next") {
          tribute.nextPage();
        }
      } else {
        let li = event.target;
        event.preventDefault();
        event.stopPropagation();
        while (li.nodeName.toLowerCase() !== "li") {
          li = li.parentNode;
          if (!li || li === tribute.menu) {
            // throw new Error("cannot find the <li> container for the click");
            return;
          }
        }
        tribute.selectItemAtIndex(li.getAttribute("data-index"), event);
        tribute.hideMenu();
      }

      // TODO: should fire with externalTrigger and target is outside of menu
    } else if (tribute.current.element && !tribute.current.externalTrigger) {
      tribute.current.externalTrigger = false;
      setTimeout(() => tribute.hideMenu());
    }
  }

  keyup(instance, event) {
    if (instance.inputEvent) {
      instance.inputEvent = false;
    }
    instance.updateSelection(this);

    if (event.keyCode === 27) return;

    if (!instance.tribute.allowSpaces && instance.tribute.hasTrailingSpace) {
      instance.tribute.hasTrailingSpace = false;
      instance.commandEvent = true;
      instance.callbacks()["space"](event, this);
      return;
    }

    if (!instance.tribute.isActive) {
      if (instance.tribute.autocompleteMode) {
        instance.callbacks().triggerChar(event, this, "");
      } else {
        let keyCode = instance.getKeyCode(instance, this, event);

        if (isNaN(keyCode) || !keyCode) return;

        let trigger = instance.tribute.triggers().find(trigger => {
          return trigger.charCodeAt(0) === keyCode;
        });

        if (typeof trigger !== "undefined") {
          instance.callbacks().triggerChar(event, this, trigger);
        }
      }
    }

    if (
      instance.tribute.current.mentionText.length <
      instance.tribute.current.collection.menuShowMinLength
    ) {
      instance.tribute.hideMenu();
      return;
    }

    if (
      ((instance.tribute.current.trigger ||
        instance.tribute.autocompleteMode) &&
        instance.commandEvent === false) ||
      (instance.tribute.isActive && event.keyCode === 8)
    ) {
      instance.tribute.showMenuFor(this, true);
    }
  }

  shouldDeactivate(event) {
    if (!this.tribute.isActive) return false;

    if (this.tribute.current.mentionText.length === 0) {
      let eventKeyPressed = false;
      TributeEvents.keys().forEach(o => {
        if (event.keyCode === o.key) eventKeyPressed = true;
      });

      return !eventKeyPressed;
    }

    return false;
  }

  getKeyCode(instance, el, event) {
    let char;
    let tribute = instance.tribute;
    let info = tribute.range.getTriggerInfo(
      false,
      tribute.hasTrailingSpace,
      true,
      tribute.allowSpaces,
      tribute.autocompleteMode
    );

    if (info) {
      return info.mentionTriggerChar.charCodeAt(0);
    } else {
      return false;
    }
  }

  updateSelection(el) {
    this.tribute.current.element = el;
    let info = this.tribute.range.getTriggerInfo(
      false,
      this.tribute.hasTrailingSpace,
      true,
      this.tribute.allowSpaces,
      this.tribute.autocompleteMode
    );

    if (info) {
      this.tribute.current.selectedPath = info.mentionSelectedPath;
      this.tribute.current.mentionText = info.mentionText;
      this.tribute.current.selectedOffset = info.mentionSelectedOffset;
    }
  }

  callbacks() {
    return {
      triggerChar: (e, el, trigger) => {
        let tribute = this.tribute;
        tribute.current.trigger = trigger;

        let collectionItem = tribute.collection.find(item => {
          return item.trigger === trigger;
        });

        tribute.current.collection = collectionItem;

        if (
          tribute.current.mentionText.length >=
            tribute.current.collection.menuShowMinLength &&
          tribute.inputEvent
        ) {
          tribute.showMenuFor(el, true);
        }
      },
      enter: (e, el) => {
        // choose selection
        if (this.tribute.isActive && this.tribute.current.filteredItems) {
          e.preventDefault();
          e.stopPropagation();
          setTimeout(() => {
            this.tribute.selectItemAtIndex(this.tribute.menuSelected, e);
            this.tribute.hideMenu();
          }, 0);
        }
      },
      escape: (e, el) => {
        if (this.tribute.isActive) {
          e.preventDefault();
          e.stopPropagation();
          this.tribute.isActive = false;
          this.tribute.hideMenu();
        }
      },
      tab: (e, el) => {
        // choose first match
        this.callbacks().enter(e, el);
      },
      space: (e, el) => {
        if (this.tribute.isActive) {
          if (this.tribute.spaceSelectsMatch) {
            e.spaceSelection = true; // custom property
            this.callbacks().enter(e, el);
          } else if (!this.tribute.allowSpaces) {
            e.stopPropagation();
            setTimeout(() => {
              this.tribute.hideMenu();
              this.tribute.isActive = false;
            }, 0);
          }
        }
      },
      up: (e, el) => {
        // navigate up ul
        if (this.tribute.isActive && this.tribute.current.filteredItems) {
          e.preventDefault();
          e.stopPropagation();
          let count = this.tribute.current.filteredItems.length,
            selected = this.tribute.menuSelected;

          if (count > selected && selected > 0) {
            this.tribute.menuSelected--;
            this.setActiveLi();
          } else if (selected === 0) {
            this.tribute.menuSelected = count - 1;
            this.setActiveLi();
            this.tribute.menu.scrollTop = this.tribute.menu.scrollHeight;
          }
        }
      },
      down: (e, el) => {
        // navigate down ul
        if (this.tribute.isActive && this.tribute.current.filteredItems) {
          e.preventDefault();
          e.stopPropagation();
          let count = this.tribute.current.filteredItems.length - 1,
            selected = this.tribute.menuSelected;

          if (count > selected) {
            this.tribute.menuSelected++;
            this.setActiveLi();
          } else if (count === selected) {
            this.tribute.menuSelected = 0;
            this.setActiveLi();
            this.tribute.menu.scrollTop = 0;
          }
        }
      },
      left: (e, el) => {
        // navigate previous page
        if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && this.tribute.isActive && this.tribute.current.filteredItems) {
          e.preventDefault();
          e.stopPropagation();
          this.tribute.previousPage();
        }
      },
      right: (e, el) => {
        // navigate next page
        if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && this.tribute.isActive && this.tribute.current.filteredItems) {
          e.preventDefault();
          e.stopPropagation();
          this.tribute.nextPage();
        }
      },
      delete: (e, el) => {
        if (
          this.tribute.isActive &&
          this.tribute.current.mentionText.length < 1
        ) {
          this.tribute.hideMenu();
        } else if (this.tribute.isActive) {
          this.tribute.showMenuFor(el);
        }
      },
      numeric: (e, index) => {
        // choose selection
        if (this.tribute.isActive && this.tribute.current.filteredItems) {
          e.preventDefault();
          e.stopPropagation();
          setTimeout(() => {
            this.tribute.selectItemAtIndex(index, e);
            this.tribute.hideMenu();
          }, 0);
        }
      },
      wordBreak: (e, el) => {
        if (this.tribute.isActive) {
          e.wordBreak = true; // custom property
          this.callbacks().enter(e, el);
        }
      }
    };
  }

  setActiveLi(index) {
    let lis = this.tribute.menu.querySelectorAll("li"),
      length = lis.length >>> 0;

    if (index) this.tribute.menuSelected = parseInt(index);

    for (let i = 0; i < length; i++) {
      let li = lis[i];
      if (i === this.tribute.menuSelected) {
        li.classList.add(this.tribute.current.collection.selectClass);

        let liClientRect = li.getBoundingClientRect();
        let menuClientRect = this.tribute.menu.getBoundingClientRect();

        if (liClientRect.bottom > menuClientRect.bottom) {
          let scrollDistance = liClientRect.bottom - menuClientRect.bottom;
          this.tribute.menu.scrollTop += scrollDistance;
        } else if (liClientRect.top < menuClientRect.top) {
          let scrollDistance = menuClientRect.top - liClientRect.top;
          this.tribute.menu.scrollTop -= scrollDistance;
        }
      } else {
        li.classList.remove(this.tribute.current.collection.selectClass);
      }
    }
  }

  getFullHeight(elem, includeMargin) {
    let height = elem.getBoundingClientRect().height;

    if (includeMargin) {
      let style = elem.currentStyle || window.getComputedStyle(elem);
      return (
        height + parseFloat(style.marginTop) + parseFloat(style.marginBottom)
      );
    }

    return height;
  }

  // Handle click events on input element
  inputClick(instance, event) {
    let tribute = instance.tribute;

    tribute.current.collection = tribute.collection.find(item => {
      return item.trigger === "";
    });

    instance.updateSelection(this);

    if (tribute.current.mentionText.length > tribute.current.collection.menuShowMinLength) {
      tribute.showMenuFor(this, true);
    }
  }
}

export default TributeEvents;
