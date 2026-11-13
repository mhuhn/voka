@voka
Feature: Position groups and compact learning controls
  Lists are grouped by position by default, with dot-only progress indicators.

  Scenario: Position sections and one-line filters are the default
    Given I open the Voka app
    When I sign in as "alice@example.test" with password "correct-password"
    And I return to vocabulary home
    And I open the English subject
    And I open the irregular verbs list
    Then the list is grouped by position and shows only visual score dots
    And the filter switches and sorting controls share a compact row

  @learning
  Scenario: Enter and Space reveal and grade known without clicking
    Given I open the Voka app
    When I sign in as "alice@example.test" with password "correct-password"
    And I return to vocabulary home
    And I open the English subject
    And I open the irregular verbs list
    And I start learning the open list
    When I reveal the hidden card with Enter
    Then the grade controls are shown above marking and editing
    When I grade the revealed card with Space
    Then the next learning question is shown
    When I reveal the hidden card with Space
    And I grade the revealed card with Enter
    Then the third learning question is shown

  @learning @calendar-blocked
  Scenario: Skip the calendar-day learning break without losing the next due cards
    Given I open the Voka app
    When I sign in as "alice@example.test" with password "correct-password"
    And I return to vocabulary home
    And I open the English subject
    And I open the irregular verbs list
    Then the list waits until tomorrow after a one-position delay
    When I skip the learning pause
    Then the next learning round is available immediately
