@voka
Feature: Learning action branding and tablet navigation
  The learning action is emphasized in the orange Voka brand style.
  A wide tablet view should return directly to all subjects.

  Scenario: Home learning button is white with black type and a short orange text underline
    Given I open the Voka app
    When I sign in as "alice@example.test" with password "correct-password"
    And I return to vocabulary home
    Then the main learning action uses a white background and short orange text underline

  Scenario: Back from a list in the two-column iPad layout opens My subjects
    Given I open the Voka app
    When I sign in as "alice@example.test" with password "correct-password"
    And I return to vocabulary home
    And I switch to iPad landscape width
    And I open the English subject
    And I open the irregular verbs list
    Then the tablet list overview back arrow returns directly to My subjects

  @de
  Scenario: Learned cards are hidden by default with correct German switch and singular counts
    Given I open the Voka app in the current locale
    When I sign in using the current locale as "alice@example.test" with password "correct-password"
    And I return to vocabulary home
    And I open the English subject
    And I open the irregular verbs list
    Then the German learned-card switch and card counts use the correct wording
