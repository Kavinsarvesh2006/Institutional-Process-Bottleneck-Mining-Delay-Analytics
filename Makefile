PYTHON ?= python
.PHONY: setup seed run demo test build
setup:
	$(PYTHON) run.py setup
seed:
	$(PYTHON) run.py seed
run:
	$(PYTHON) run.py run
demo:
	$(PYTHON) run.py demo
test:
	$(PYTHON) run.py test
build:
	$(PYTHON) run.py build
