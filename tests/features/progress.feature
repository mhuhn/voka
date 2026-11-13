@voka @progress
Feature: List progress is visible before opening a list

  Scenario: Equal-weight four-point progress in the subject's list overview
    Given I open the Voka app
    When I sign in as "alice@example.test" with password "correct-password"
    And I return to vocabulary home
    And I open the English subject
    Then the list overview shows the equally weighted 45-percent progress
