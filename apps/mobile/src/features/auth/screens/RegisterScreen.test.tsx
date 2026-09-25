import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { RegisterScreen } from './RegisterScreen'
import { useRegister, useRedeemCoupon } from '@project/sdk'
import { setToken } from '../../../lib/authToken'
import { queryClient } from '../../../lib/queryClient'

// Mock dependencies
jest.mock('@project/sdk', () => ({
  useRegister: jest.fn(),
  useRedeemCoupon: jest.fn(),
}))

jest.mock('../../../lib/authToken', () => ({
  setToken: jest.fn(),
}))

jest.mock('../../../lib/queryClient', () => ({
  queryClient: {
    invalidateQueries: jest.fn(),
  },
}))

// Mock SelectField to simplify testing date inputs
jest.mock('../../../ui/SelectField', () => ({
  SelectField: ({ testID, onSelect }: any) => {
    const { TextInput } = require('react-native')
    return <TextInput testID={testID} onChangeText={onSelect} />
  },
}))

describe('RegisterScreen', () => {
  it('successfully registers with valid credentials', async () => {
    const mockMutateAsync = jest.fn().mockResolvedValue({ token: 'fake-register-token' })
    ;(useRegister as jest.Mock).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    })
    
    ;(useRedeemCoupon as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    })

    const mockNavigation = { navigate: jest.fn() } as any

    const { getByTestId } = render(<RegisterScreen navigation={mockNavigation} route={{} as any} />)

    const submitButton = getByTestId('register.submit')
    
    // Initial state: button should be disabled
    expect(submitButton).toBeDisabled()

    // Fill in required text fields
    fireEvent.changeText(getByTestId('register.email'), 'test@example.com')
    fireEvent.changeText(getByTestId('register.password'), 'password123')
    fireEvent.changeText(getByTestId('register.username'), 'tester')
    fireEvent.changeText(getByTestId('register.display-name'), 'Test User')
    
    // Fill in mocked select fields for birthdate
    fireEvent.changeText(getByTestId('register.month'), '01')
    fireEvent.changeText(getByTestId('register.day'), '15')
    fireEvent.changeText(getByTestId('register.year'), '1990')

    // Button should now be enabled
    expect(submitButton).not.toBeDisabled()

    // Submit the form
    fireEvent.press(submitButton)

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        username: 'tester',
        displayName: 'Test User',
        birthdate: '1990-01-15',
      })
      expect(setToken).toHaveBeenCalledWith('fake-register-token')
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['me'] })
    })
  })
})
